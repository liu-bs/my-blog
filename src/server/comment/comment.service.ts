/**
 * @file comment.service.ts
 * @description 评论业务规则层：负责可评论性校验、正文清洗、权限归属判断以及「评论记录 + 文章评论数」的事务一致性。
 * 评论必须登录后发表；草稿文章不可评论（由 blog.service 的断言保证）；删除权限同时授予评论作者与文章作者。
 * 评论上的作者昵称 / 头像是写入时的快照，用户改资料后需通过 syncCommentAuthorProfile 回填。
 * 使用限制：只供 server 侧 Controller / Server Action 调用，不直接接触 HTTP。
 */
import "server-only";

import type { Comment } from "@shared";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@server/common/errors";
import sanitizeHtml from "sanitize-html";
import type { CreateCommentDto, ListCommentsOptions } from "@shared";
import { findUserById } from "@server/user/user.repository";
import { getPrisma } from "@server/common/db";
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

/** 评论列表单页上限，防止前端传入过大 limit 造成慢查询 */
const MAX_PAGE_SIZE = 50;

/**
 * 清洗评论正文
 * @param content 用户提交的原始正文
 * @returns 去除全部 HTML 标签与属性并 trim 后的纯文本
 * @description 评论只允许纯文本，因此白名单为空，避免存储型 XSS；存库前就清洗，保证历史数据同样安全
 */
function sanitizeCommentContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * 分页查询文章的评论列表
 * @param options 查询条件：postId 必填，user 用于判断文章可见性，limit / offset 控制分页
 * @returns comments 当前页评论、total 总条数、hasMore 是否还有下一页
 * @throws NotFoundError 文章不存在
 * @throws ForbiddenError 草稿文章对当前访问者不可见
 * @description 通过多取一条（take + 1）判断 hasMore，避免额外的 count 查询；limit 会被夹在 1..MAX_PAGE_SIZE 之间
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
 * 发表评论
 * @param dto 评论内容 + 目标文章 ID + 评论人 ID（用户身份来自已校验的登录态）
 * @returns 新建的评论对象
 * @throws NotFoundError 文章不存在，或评论人用户已被删除
 * @throws ForbiddenError 文章为草稿 / 未发布，不可评论
 * @description 昵称与头像在写入时做快照，展示评论列表时无需再联表查询用户；
 * 评论写入与文章 commentsCount 自增放在同一事务，避免出现评论数与实际条数不一致
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
    // 优先展示「名 姓」，未填写时退回用户名
    userName: `${user.firstName} ${user.lastName}`.trim() || user.username,
    userAvatar: user.avatar || undefined,
    content: sanitizeCommentContent(dto.content),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await getPrisma().$transaction(async (tx) => {
      await createCommentRecord(comment, tx);
      await incrementPostField(dto.postId, "commentsCount", 1, tx);
    });
  } catch (err) {
    // 校验与写入之间文章被并发删除：计数或评论外键写入失败（P2025 / P2003），按「文章不存在」返回而非 500
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
 * 编辑评论
 * @param id 评论 ID
 * @param content 新正文
 * @param currentUserId 当前登录用户 ID
 * @returns 更新后的评论
 * @throws NotFoundError 评论不存在
 * @throws ForbiddenError 当前用户不是评论作者
 * @throws ValidationError 清洗后正文为空
 * @description 仅评论作者本人可编辑，文章作者不继承编辑权；先清洗再判空，避免只提交空白字符绕过校验
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
    // 校验与写入之间被并发删除，按「评论不存在」返回，避免暴露内部竞态
    throw new NotFoundError("Comment not found");
  }
  return updated;
}

/**
 * 删除评论
 * @param id 评论 ID
 * @param currentUserId 当前登录用户 ID
 * @returns 被删评论所属的文章 ID，供上层失效缓存
 * @throws NotFoundError 评论不存在
 * @throws ForbiddenError 既不是评论作者也不是文章作者
 * @description 删除权限同时授予评论作者与文章作者（博主可清理自己文章下的不当评论）；
 * 删除记录与文章评论数自减在同一事务内完成，保证计数不漂移
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
    await getPrisma().$transaction(async (tx) => {
      await deleteCommentRecord(id, tx);
      await incrementPostField(row.postId, "commentsCount", -1, tx);
    });
  } catch (err) {
    // 并发窗口内文章已被删除：评论计数目标不存在（P2025），评论行也已随外键级联消失，视为删除成功
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { postId: row.postId };
    }
    throw err;
  }

  return { postId: row.postId };
}

/**
 * 同步评论上的作者资料快照
 * @param userId 用户 ID
 * @param userName 新昵称
 * @param userAvatar 新头像，null 表示清除
 * @returns 被更新的评论条数
 * @description 用户修改昵称 / 头像后由用户资料流程调用，把冗余在历史评论上的快照批量刷新
 */
export async function syncCommentAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<number> {
  return updateCommentsAuthor(userId, userName, userAvatar);
}
