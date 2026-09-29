/**
 * @file comment.repository.ts
 * @description 评论表的 Prisma 数据访问层：只负责读写 Comment 表并把行记录映射为共享层 Comment 类型，不含任何业务判断。
 * 作者昵称 / 头像以快照形式冗余存在评论行上，因此更新资料时需要专门同步（updateCommentsAuthor）。
 * 使用限制：仅供 server 侧调用；涉及计数的写操作需由 Service 传入事务，保证评论与文章评论数一致。
 */
import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { Comment } from "@shared";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：既接受普通 PrismaClient，也接受 $transaction 回调里传入的事务对象 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Comment 表的行结构（与 Prisma schema 对应），用于把行数据映射成领域对象 */
type PrismaComment = {
  /** 评论主键 */
  id: string;
  /** 所属文章 ID */
  postId: string;
  /** 评论作者用户 ID */
  userId: string;
  /** 评论时记录的作者昵称快照 */
  userName: string;
  /** 评论时记录的作者头像快照，未设置为 null */
  userAvatar: string | null;
  /** 评论正文（入库前已清洗为纯文本） */
  content: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后修改时间 */
  updatedAt: Date;
};

/**
 * 把 Comment 表行映射为前后端共享的 Comment 类型
 * @param p 数据库行记录
 * @returns 共享层评论对象；Date 统一转为 ISO 字符串，便于跨 Server/Client 边界序列化
 * @description 头像为 null 时映射为 undefined，与共享类型的可选字段语义保持一致
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
 * 查询某篇文章下的评论列表
 * @param postId 文章 ID
 * @param opts 分页参数；take 为本次取几条，skip 为跳过条数，均不传时取全部
 * @returns 评论列表
 * @description 排序用 createdAt 加 id 双重倒序，避免同一毫秒创建的评论顺序不稳定
 */
export async function findCommentsByPostId(
  postId: string,
  opts?: { take?: number; skip?: number },
): Promise<Comment[]> {
  const rows = await getPrisma().comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // 仅在显式传入时才拼 take / skip，防止 undefined 被 Prisma 当作 0 处理导致多查
    ...(opts?.take !== undefined && { take: opts.take }),
    ...(opts?.skip !== undefined && { skip: opts.skip }),
  });
  return rows.map(mapToComment);
}

/**
 * 统计某篇文章的评论总数
 * @param postId 文章 ID
 * @returns 评论条数
 * @description 用于分页的 total，与列表查询并行发起
 */
export async function countComments(postId: string): Promise<number> {
  return getPrisma().comment.count({ where: { postId } });
}

/**
 * 新增一条评论记录
 * @param comment 已构造好的评论领域对象，主键由 Service 生成
 * @param tx 可选事务客户端；Service 需与文章评论数自增保持原子性时传入
 * @returns 无返回，仅表示写入完成
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
 * 删除一条评论记录
 * @param id 评论 ID
 * @param tx 可选事务客户端，需与文章评论数回退同事务时传入
 * @throws Prisma P2025 记录不存在时抛错，由 Service 保证调用前已确认存在
 */
export async function deleteCommentRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.delete({ where: { id } });
}

/**
 * 按 ID 查询单条评论
 * @param id 评论 ID
 * @returns 评论对象，不存在返回 null
 * @description 主要供编辑场景读取作者归属，用于判断当前用户是否有权限
 */
export async function findCommentById(id: string): Promise<Comment | null> {
  const row = await getPrisma().comment.findUnique({ where: { id } });
  return row ? mapToComment(row) : null;
}

/**
 * 查询删除评论所需的归属信息
 * @param id 评论 ID
 * @returns 含评论作者与文章作者 ID 的轻量结构，不存在返回 null
 * @description 删除权限是「评论作者或文章作者」，因此需要一次性带出 post.authorId，避免多查一次文章
 */
export async function findCommentForDelete(id: string): Promise<{
  /** 评论 ID */
  id: string;
  /** 评论所属文章 ID，删除后用于回退文章评论数与失效缓存 */
  postId: string;
  /** 评论作者用户 ID */
  userId: string;
  /** 文章作者用户 ID，文章作者已被删除时为 null */
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
 * 更新评论正文
 * @param id 评论 ID
 * @param data 新正文与更新时间（ISO 字符串）
 * @returns 更新后的评论，记录已不存在时返回 null
 * @description 把 Prisma 的 P2025（记录不存在）转为 null 而不是抛出，让 Service 能统一按「评论不存在」处理并发删除
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
 * 同步某用户全部评论上的作者快照
 * @param userId 用户 ID
 * @param userName 新昵称
 * @param userAvatar 新头像，null 表示清除
 * @returns 被更新的评论条数
 * @description 昵称 / 头像是历史评论上的冗余快照，用户改资料后靠这里批量回填，展示时无需再联表查用户
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
