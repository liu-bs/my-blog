/**
 * @file comment.service.ts
 * @description 评论业务服务层。列表读取先断言文章可读，创建/删除在同一事务内维护文章
 * commentsCount；内容统一剥离全部 HTML 标签后存纯文本（防 XSS）；删除权限为评论作者
 * 或文章作者；提供用户改名/换头像后对历史评论冗余字段的批量同步。
 */
import "server-only";

import type { Comment } from "@shared";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@server/common/errors";
import sanitizeHtml from "sanitize-html";
import type { CreateCommentDto, ListCommentsOptions } from "@shared";
import { findUserById } from "@server/user/user.repository";
import { runInTransaction } from "@server/common/db";
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

/** 评论列表单页上限 */
const MAX_PAGE_SIZE = 50;

/**
 * 净化评论内容：剥离全部 HTML 标签与属性，仅保留纯文本
 * @param content 原始评论内容
 * @returns 去除首尾空白后的纯文本
 */
function sanitizeCommentContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * 分页查询文章的评论列表
 * 先断言文章对请求者可读（草稿仅作者可看评论）；多取一条探测 hasMore
 * @param options 查询选项（文章 id、用户、分页）
 * @returns 评论列表、总数与是否还有更多
 * @throws 文章不可读时抛 NotFoundError
 */
export async function listComments(
  options: ListCommentsOptions,
): Promise<{ comments: Comment[]; total: number; hasMore: boolean }> {
  await assertPostReadable(options.postId, options.user?.id);

  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));
  const skip = Math.max(0, options.offset ?? 0);

  const [rows, total] = await Promise.all([
    findCommentsByPostId(options.postId, { take: take + 1, skip }),
    countComments(options.postId),
  ]);

  const hasMore = rows.length > take;
  return { comments: hasMore ? rows.slice(0, take) : rows, total, hasMore };
}

/**
 * 创建评论：断言文章可评论、快照作者昵称/头像、内容净化为纯文本；
 * 事务内落库并给文章 commentsCount +1，文章不存在时整体回滚
 * @param dto 评论数据（含文章 id 与用户 id）
 * @returns 创建后的 Comment
 * @throws 文章是草稿抛 ForbiddenError；文章/用户不存在抛 NotFoundError
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

    userName: `${user.firstName} ${user.lastName}`.trim() || user.username,
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
 * 编辑评论（仅评论作者本人可改）：内容净化后非空才允许更新
 * @param id 评论 id
 * @param content 新内容
 * @param currentUserId 当前登录用户 id
 * @returns 更新后的 Comment
 * @throws 评论不存在抛 NotFoundError；非作者抛 ForbiddenError；净化后为空抛 ValidationError
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
 * 删除评论，权限为评论作者或文章作者
 * 事务内删除记录并给文章 commentsCount -1；评论已被并发删除（P2025）时按幂等成功处理
 * @param id 评论 id
 * @param currentUserId 当前登录用户 id
 * @returns 被删评论所属文章 id（调用方用于小范围缓存失效）
 * @throws 评论不存在抛 NotFoundError；无权限抛 ForbiddenError
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
 * 用户改名/换头像后，批量同步其历史评论的冗余作者字段
 * @param userId 用户 id
 * @param userName 新昵称
 * @param userAvatar 新头像，可为 null
 * @returns 更新的评论条数
 */
export async function syncCommentAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<number> {
  return updateCommentsAuthor(userId, userName, userAvatar);
}
