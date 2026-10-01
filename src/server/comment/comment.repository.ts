/**
 * @file comment.repository.ts
 * @description 评论数据访问层。负责 Comment 领域模型与 Prisma 行结构的双向映射
 * （日期转 ISO 字符串），提供按文章分页查询、计数、增删改查及历史评论作者冗余字段的批量同步。
 */
import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { Comment } from "@shared";
import { getPrisma } from "@server/common/db";

/** 可执行数据库操作的客户端：普通实例或事务客户端 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Prisma Comment 行结构（userName/userAvatar 为创建时的作者信息快照）
 */
type PrismaComment = {
  id: string;

  postId: string;

  userId: string;

  userName: string;

  userAvatar: string | null;

  content: string;

  createdAt: Date;

  updatedAt: Date;
};

/**
 * 将 Prisma 评论行映射为 Comment 领域模型（日期转 ISO 字符串，null 归一为 undefined）
 * @param p Prisma 评论行
 * @returns Comment 领域模型
 */
export function mapToComment(p: PrismaComment): Comment {
  return {
    id: p.id,
    postId: p.postId,
    userId: p.userId,
    userName: p.userName,
    userAvatar: p.userAvatar ?? undefined,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/**
 * 按文章查询评论列表，创建时间倒序（同刻以 id 兜底保证稳定排序）
 * @param postId 文章 id
 * @param opts.take 返回条数上限
 * @param opts.skip 跳过条数
 * @returns 评论列表
 */
export async function findCommentsByPostId(
  postId: string,
  opts?: { take?: number; skip?: number },
): Promise<Comment[]> {
  const rows = await getPrisma().comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    ...(opts?.take !== undefined && { take: opts.take }),
    ...(opts?.skip !== undefined && { skip: opts.skip }),
  });
  return rows.map(mapToComment);
}

/**
 * 统计文章评论总数
 * @param postId 文章 id
 * @returns 评论总数
 */
export async function countComments(postId: string): Promise<number> {
  return getPrisma().comment.count({ where: { postId } });
}

/**
 * 创建评论记录
 * @param comment 待写入的 Comment
 * @param tx 可选事务客户端
 */
export async function createCommentRecord(comment: Comment, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.create({
    data: {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar ?? null,
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
    },
  });
}

/**
 * 删除评论记录
 * @param id 评论 id
 * @param tx 可选事务客户端
 */
export async function deleteCommentRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.delete({ where: { id } });
}

/**
 * 按 id 查询评论
 * @param id 评论 id
 * @returns Comment，不存在时为 null
 */
export async function findCommentById(id: string): Promise<Comment | null> {
  const row = await getPrisma().comment.findUnique({ where: { id } });
  return row ? mapToComment(row) : null;
}

/**
 * 查询删除评论所需的权限判定信息（评论作者 + 所属文章作者）
 * @param id 评论 id
 * @returns 判定信息，评论不存在时为 null
 */
export async function findCommentForDelete(id: string): Promise<{
  id: string;

  postId: string;

  userId: string;

  postAuthorId: string | null;
} | null> {
  const row = await getPrisma().comment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      userId: true,
      post: { select: { authorId: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    postAuthorId: row.post.authorId,
  };
}

/**
 * 更新评论内容
 * @param id 评论 id
 * @param data.content 新内容（已净化）
 * @param data.updatedAt 更新时间（ISO 字符串）
 * @returns 更新后的 Comment，评论已被并发删除（P2025）时为 null
 */
export async function updateCommentRecord(
  id: string,
  data: { content: string; updatedAt: string },
): Promise<Comment | null> {
  try {
    const updated = await getPrisma().comment.update({
      where: { id },
      data: { content: data.content, updatedAt: new Date(data.updatedAt) },
    });
    return mapToComment(updated);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "P2025") return null;
    throw err;
  }
}

/**
 * 批量同步指定用户全部评论的作者昵称与头像（用户资料变更后调用）
 * @param userId 评论作者用户 id
 * @param userName 新昵称
 * @param userAvatar 新头像，可为 null
 * @returns 更新的评论条数
 */
export async function updateCommentsAuthor(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<number> {
  const result = await getPrisma().comment.updateMany({
    where: { userId },
    data: { userName, userAvatar },
  });
  return result.count;
}
