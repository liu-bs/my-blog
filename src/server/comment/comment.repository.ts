import "server-only";

/**
 * @file 评论域数据仓库层
 * @description 只负责 Comment 表的 Prisma 读写与行 → shared Comment 的形状映射（Date → ISO、null → undefined）。
 * 写函数接受可选 tx 事务客户端，评论与文章评论数的同事务一致性由 comment.service 组织。
 * 注意：userName/userAvatar 是发表时的冗余快照，用户改名由 updateCommentsAuthor 批量同步。
 */

import type { PrismaClient } from "@prisma/client";
import type { Comment } from "@shared";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：可传全局 PrismaClient 或 $transaction 回调内的 tx */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Comment 表行结构
 */
type PrismaComment = {
  /** 评论唯一ID */
  id: string;

  /** 所属文章 ID */
  postId: string;

  /** 评论者用户 ID */
  userId: string;

  /** 评论者展示名（冗余快照） */
  userName: string;

  /** 评论者头像（冗余快照），可为 null */
  userAvatar: string | null;

  /** 评论内容（服务端已净化为纯文本） */
  content: string;

  /** 创建时间 */
  createdAt: Date;

  /** 最后编辑时间 */
  updatedAt: Date;
};

/** Prisma 行 → shared Comment：Date 转 ISO，userAvatar 的 null 归一为 undefined */
function mapToComment(p: PrismaComment): Comment {
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
 * 按文章分页拉取评论：创建时间倒序，同秒数据用 id 兜底保证稳定顺序
 * @param postId 文章 ID
 * @param opts take/skip 分页参数（service 层多取一条判断 hasMore）
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
 * 统计某文章的评论总数（分页 total 用）
 * @param postId 文章 ID
 * @returns 评论条数
 */
export async function countComments(postId: string): Promise<number> {
  return getPrisma().comment.count({ where: { postId } });
}

/**
 * 插入评论记录（字符串时间转 Date 落库）
 * @param comment 完整 Comment（ID、冗余用户名由 service 生成）
 * @param tx 可选事务客户端；与文章 commentsCount 递增同事务时必传
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
 * 按 ID 物理删除评论
 * @param id 评论 ID
 * @param tx 可选事务客户端；与 commentsCount 回退同事务时必传
 */
export async function deleteCommentRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.delete({ where: { id } });
}

/**
 * 按 ID 查询单条评论完整记录
 * @param id 评论 ID
 * @returns Comment；不存在时 null
 */
export async function findCommentById(id: string): Promise<Comment | null> {
  const row = await getPrisma().comment.findUnique({ where: { id } });
  return row ? mapToComment(row) : null;
}

/**
 * 删除前置查询：只取权限判定所需列（评论者 + 通过关联取文章作者），避免拉全行
 * @param id 评论 ID
 * @returns 权限判断所需的最小信息；评论不存在时 null
 */
export async function findCommentForDelete(id: string): Promise<{
  /** 评论 ID */
  id: string;

  /** 所属文章 ID（删除后需回退该文章评论数） */
  postId: string;

  /** 评论者用户 ID */
  userId: string;

  /** 文章作者 ID（作者可删自己文章下的评论），可为 null */
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
 * 更新评论内容与编辑时间
 * @param id 评论 ID
 * @param data 新内容（已净化）与更新时间（ISO 字符串）
 * @returns 更新后的 Comment；P2025（记录已被并发删除）归一为 null，其余错误抛出
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
 * 批量同步某用户全部评论的展示名/头像冗余快照（用户改名后由 auth.service 级联调用）
 * @param userId 评论者用户 ID
 * @param userName 新展示名
 * @param userAvatar 新头像，null 表示清除
 * @returns 被更新的评论条数（调用方以此判断是否记录日志）
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
