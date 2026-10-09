import "server-only";

/**
 * @file 评论域业务服务层
 * @description 评论列表/发表/编辑/删除的业务逻辑，以及改名后的评论快照同步。
 * 权限模型：发表评论要求文章存在且非草稿（复用 blog.service 断言）；编辑仅限评论作者本人；
 * 删除允许评论作者或文章作者。评论写库与文章 commentsCount 计数增减在同一事务内保证一致。
 */

import type { Comment } from "@shared";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@server/common/errors";
import sanitizeHtml from "sanitize-html";
import type { CreateCommentDto, ListCommentsOptions } from "@shared";
import { findUserById } from "@server/user/user.repository";
import { runInTransaction } from "@server/common/db";
import { joinName } from "@shared/format";
import { assertPostReadable, assertPostCommentable } from "@server/blog/blog.service";
import { incrementPostField } from "@server/blog/blog.repository";
import {
  findCommentsByPostId,
  countComments,
  createCommentRecord,
  deleteCommentRecord,
  findCommentById,
  findCommentForDelete,
  updateCommentRecord,
  updateCommentsAuthor,
} from "./comment.repository";

/** 评论列表默认每页条数 */
const DEFAULT_PAGE_SIZE = 10;

/** 评论列表每页条数上限（防止恶意大 limit） */
const MAX_PAGE_SIZE = 50;

/** 评论内容净化：剥离全部 HTML 标签只留纯文本并 trim（评论不支持富文本，防 XSS 的强策略） */
function sanitizeCommentContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * 评论分页列表（创建时间倒序）
 * @param options postId、limit/offset，可选 user（草稿文章的作者可读）
 * @returns { comments, total, hasMore }；total 为该文章全部评论数
 * @throws NotFoundError——文章不存在（404）；草稿对非作者也报 404
 * @warning 多取一条（take+1）判断 hasMore，返回前再切回 take 条，避免额外 COUNT 之外的查询
 */
export async function listComments(
  options: ListCommentsOptions,
): Promise<{ comments: Comment[]; total: number; hasMore: boolean }> {
  await assertPostReadable(options.postId, options.user?.id);

  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));
  const skip = Math.max(0, options.offset ?? 0);

  // 多取一条仅用于判断 hasMore，返回前切掉，省掉一次"总数 vs 偏移"比较
  const [rows, total] = await Promise.all([
    findCommentsByPostId(options.postId, { take: take + 1, skip }),
    countComments(options.postId),
  ]);

  const hasMore = rows.length > take;
  return { comments: hasMore ? rows.slice(0, take) : rows, total, hasMore };
}

/**
 * 发表评论
 * @description 前置断言文章可评论 → 生成评论（用户名/头像取当前用户快照、内容净化）→
 * 事务内插入记录并递增文章 commentsCount
 * @param dto 评论 DTO + 服务端注入的 postId/userId
 * @returns 新建的 Comment
 * @throws NotFoundError——文章不存在或外键指向缺失（P2025/P2003 归一为 404）、用户不存在（404）；ForbiddenError——草稿（403）
 * @warning 评论插入与 commentsCount 递增同事务回滚；快照冗余意味着之后改名不会追改旧评论（改名走 syncCommentAuthorProfile）
 */
export async function createComment(
  dto: CreateCommentDto & { postId: string; userId: string },
): Promise<Comment> {
  await assertPostCommentable(dto.postId);

  const user = await findUserById(dto.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const now = new Date().toISOString();
  const comment: Comment = {
    id: randomUUID(),
    postId: dto.postId,
    userId: dto.userId,

    userName: joinName(user.firstName, user.lastName) || user.username,
    userAvatar: user.avatar || undefined,
    content: sanitizeCommentContent(dto.content),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await runInTransaction(async (tx) => {
      await createCommentRecord(comment, tx);
      await incrementPostField(dto.postId, "commentsCount", 1, tx);
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2025" || err.code === "P2003")
    ) {
      throw new NotFoundError("Post not found");
    }
    throw err;
  }

  return comment;
}

/**
 * 编辑评论（仅评论作者本人）
 * @param id 评论 ID
 * @param content 新内容（服务端再次净化，不信任前端）
 * @param currentUserId 当前用户 ID
 * @returns 更新后的 Comment
 * @throws NotFoundError——评论不存在或已被并发删除（404）；ForbiddenError——非本人评论（403）；ValidationError——净化后内容为空（400）
 */
export async function updateComment(
  id: string,
  content: string,
  currentUserId: string,
): Promise<Comment> {
  const row = await findCommentById(id);
  if (!row) {
    throw new NotFoundError("Comment not found");
  }
  if (row.userId !== currentUserId) {
    throw new ForbiddenError("Not authorized to edit this comment");
  }

  const trimmed = sanitizeCommentContent(content);
  if (trimmed.length === 0) {
    throw new ValidationError("Comment content cannot be empty");
  }

  const now = new Date().toISOString();
  const updated = await updateCommentRecord(id, { content: trimmed, updatedAt: now });
  if (!updated) {
    throw new NotFoundError("Comment not found");
  }
  return updated;
}

/**
 * 删除评论（评论作者或文章作者均可）
 * @param id 评论 ID
 * @param currentUserId 当前用户 ID
 * @returns 所属文章 postId（controller 用它失效文章缓存）
 * @throws NotFoundError——评论不存在（404）；ForbiddenError——两者都不是（403）
 * @warning 删除与 commentsCount 回退同事务；计数行缺失（P2025）时视为已删成功，返回 postId 不抛错
 */
export async function deleteComment(
  id: string,
  currentUserId: string,
): Promise<{ postId: string }> {
  const row = await findCommentForDelete(id);
  if (!row) {
    throw new NotFoundError("Comment not found");
  }

  const isCommentAuthor = row.userId === currentUserId;
  const isPostAuthor = row.postAuthorId === currentUserId;
  if (!isCommentAuthor && !isPostAuthor) {
    throw new ForbiddenError("Not authorized to delete this comment");
  }

  try {
    await runInTransaction(async (tx) => {
      await deleteCommentRecord(id, tx);
      await incrementPostField(row.postId, "commentsCount", -1, tx);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { postId: row.postId };
    }
    throw err;
  }

  return { postId: row.postId };
}

/**
 * 同步某用户全部评论的展示名/头像快照（auth.service.updateProfile 改名后级联调用）
 * @param userId 评论者用户 ID
 * @param userName 新展示名
 * @param userAvatar 新头像，null 表示清除
 * @returns 被更新的评论条数
 */
export async function syncCommentAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<number> {
  return updateCommentsAuthor(userId, userName, userAvatar);
}
