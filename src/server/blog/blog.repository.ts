/**
 * @file blog.repository.ts
 * @description 文章数据访问层。负责 Post 领域模型与 Prisma 行结构的双向映射（日期转 ISO 字符串），
 * 提供列表查询（条件组合/置顶优先/未发布排后）、分类与标签聚合（ unnest 展开数组标签统计）、
 * 增删改、计数字段原子增减、旧 id 迁移映射查询及相邻文章查询。
 */
import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import type { Post } from "@shared";
import { getPrisma } from "@server/common/db";

/** 可执行数据库操作的客户端：普通实例或事务客户端 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Prisma Post 行结构（与领域模型一致，日期为 Date 对象）
 */
type PrismaPost = {
  id: string;

  title: string;

  summary: string;

  content: string;

  category: string;

  tags: string[];

  createdAt: Date;

  updatedAt: Date;

  publishedAt: Date | null;

  isDraft: boolean;

  pinned: boolean;

  coverImage: string | null;

  authorId: string | null;

  authorName: string | null;

  views: number;

  likes: number;

  favorites: number;

  commentsCount: number;
};

/** Date 转 ISO 8601 字符串 */
function iso(d: Date): string {
  return d.toISOString();
}

/**
 * 将 Prisma Post 行映射为 Post 领域模型（日期转 ISO 字符串，null 归一为 undefined）
 * @param p Prisma 文章行
 * @returns Post 领域模型
 */
export function mapToPost(p: PrismaPost): Post {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    content: p.content,
    category: p.category,
    tags: p.tags,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
    publishedAt: p.publishedAt ? iso(p.publishedAt) : undefined,
    isDraft: p.isDraft,
    pinned: p.pinned,
    coverImage: p.coverImage ?? undefined,
    authorId: p.authorId ?? undefined,
    authorName: p.authorName ?? undefined,
    views: p.views,
    likes: p.likes,
    favorites: p.favorites,
    commentsCount: p.commentsCount,
  };
}

/** 列表查询的字段裁剪配置：不取大字段 content，降低列表查询与缓存开销 */
const POST_LIST_SELECT = {
  id: true,
  title: true,
  summary: true,
  category: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  isDraft: true,
  pinned: true,
  coverImage: true,
  authorId: true,
  authorName: true,
  views: true,
  likes: true,
  favorites: true,
  commentsCount: true,
} as const;

/** 列表行结构：完整行去掉 content */
type PrismaPostList = Omit<PrismaPost, "content">;

/** 列表行映射：content 以空串占位（列表场景不消费正文） */
function mapToListPost(p: PrismaPostList): Post {
  return mapToPost({ ...p, content: "" });
}

/**
 * 文章查询条件与排序选项
 */
export interface PostQueryOptions {
  /** 是否草稿，不传则不过滤 */
  isDraft?: boolean;

  /** 按作者过滤 */
  authorId?: string;

  /** 按分类过滤 */
  category?: string;

  /** 按标签过滤（数组包含匹配） */
  tag?: string;

  /** 关键词搜索（标题/正文不区分大小写包含） */
  q?: string;

  /** 按 id 集合过滤 */
  ids?: string[];

  /** 排序字段与方向，默认按发布时间倒序 */
  orderBy?: { field: "publishedAt" | "createdAt" | "updatedAt"; direction: "asc" | "desc" };

  /** 置顶文章是否排最前 */
  pinnedFirst?: boolean;

  /** 跳过条数（分页偏移） */
  skip?: number;

  /** 返回条数上限 */
  take?: number;
}

/**
 * 按 id 查询单篇文章（含正文）
 * @param id 文章 id
 * @returns Post，不存在时为 null
 */
export async function findPostById(id: string): Promise<Post | null> {
  const post = await getPrisma().post.findUnique({ where: { id } });
  return post ? mapToPost(post) : null;
}

/**
 * 将通用查询选项编译为 Prisma where 条件
 * @param where 查询选项
 * @returns Prisma where 输入
 */
function buildPrismaWhere(where: PostQueryOptions): Prisma.PostWhereInput {
  const prismaWhere: Prisma.PostWhereInput = {};
  if (where.isDraft !== undefined) prismaWhere.isDraft = where.isDraft;
  if (where.authorId) prismaWhere.authorId = where.authorId;
  if (where.category) prismaWhere.category = where.category;
  if (where.tag) prismaWhere.tags = { has: where.tag };
  if (where.ids && where.ids.length > 0) prismaWhere.id = { in: where.ids };

  if (where.q) {
    prismaWhere.OR = [
      { title: { contains: where.q, mode: "insensitive" } },
      { content: { contains: where.q, mode: "insensitive" } },
    ];
  }
  return prismaWhere;
}

/**
 * 按条件查询文章列表（不含正文字段）
 * 置顶优先；publishedAt 排序时未发布（null）一律排最后
 * @param where 查询选项
 * @returns 文章列表
 */
export async function findPosts(where: PostQueryOptions): Promise<Post[]> {
  const orderBy: Prisma.PostOrderByWithRelationInput[] = [];
  if (where.pinnedFirst) orderBy.push({ pinned: "desc" });

  const sortField = where.orderBy?.field ?? "publishedAt";
  const sortDir = where.orderBy?.direction ?? "desc";

  if (sortField === "publishedAt") orderBy.push({ publishedAt: { sort: sortDir, nulls: "last" } });
  else if (sortField === "createdAt") orderBy.push({ createdAt: sortDir });
  else orderBy.push({ updatedAt: sortDir });

  const posts = await getPrisma().post.findMany({
    where: buildPrismaWhere(where),
    orderBy,
    select: POST_LIST_SELECT,
    ...(where.skip !== undefined && { skip: where.skip }),
    ...(where.take !== undefined && { take: where.take }),
  });
  return posts.map(mapToListPost);
}

/**
 * 按相同条件统计文章总数（与 findPosts 配套计算分页）
 * @param where 查询选项
 * @returns 总条数
 */
export async function countPosts(where: PostQueryOptions): Promise<number> {
  return getPrisma().post.count({ where: buildPrismaWhere(where) });
}

/**
 * 从已发布文章中聚合去重的分类列表
 * @returns 分类名数组
 */
export async function getCategoriesFromDb(): Promise<string[]> {
  const rows = await getPrisma().post.findMany({
    where: { isDraft: false },
    select: { category: true },
    distinct: ["category"],
  });
  return rows.map((r) => r.category).filter(Boolean);
}

/**
 * 统计已发布文章的标签及使用次数
 * 用 SQL unnest 展开数组标签列后 GROUP BY 聚合
 * @returns 标签与计数数组，按标签名排序
 */
export async function getTagsFromDb(): Promise<{ name: string; count: number }[]> {
  const rows = await getPrisma().$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, COUNT(*)::bigint as count
    FROM (
      SELECT unnest(tags) AS tag FROM "Post" WHERE "isDraft" = false
    ) t
    GROUP BY tag
    ORDER BY tag
  `;
  return rows.map((r) => ({ name: r.tag, count: Number(r.count) }));
}

/**
 * 将 Post 领域模型转换为 Prisma 创建入参（ISO 字符串转 Date，缺省字段填列默认值）
 * @param p Post 领域模型
 */
function postToCreateData(p: Post): Prisma.PostUncheckedCreateInput {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    content: p.content,
    category: p.category,
    tags: p.tags,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    isDraft: p.isDraft,
    pinned: p.pinned ?? false,
    coverImage: p.coverImage ?? null,
    authorId: p.authorId ?? null,
    authorName: p.authorName ?? null,
    views: p.views ?? 0,
    likes: p.likes ?? 0,
    favorites: p.favorites ?? 0,
    commentsCount: p.commentsCount ?? 0,
  };
}

/**
 * 文章部分更新数据（日期为 ISO 字符串，null 表示显式清空）
 */
export type PostUpdateData = Partial<{
  title: string;

  summary: string;

  content: string;

  category: string;

  tags: string[];

  createdAt: string;

  updatedAt: string;

  publishedAt: string | null;

  isDraft: boolean;

  pinned: boolean;

  coverImage: string | null;

  authorId: string | null;

  authorName: string | null;

  views: number;

  likes: number;

  favorites: number;

  commentsCount: number;
}>;

/**
 * 将部分更新数据转换为 Prisma 更新入参（仅显式传入的字段参与更新）
 * @param data 部分更新数据
 */
function postToUpdateData(data: PostUpdateData): Prisma.PostUncheckedUpdateInput {
  const result: Prisma.PostUncheckedUpdateInput = {};
  if (data.title !== undefined) result.title = data.title;
  if (data.summary !== undefined) result.summary = data.summary;
  if (data.content !== undefined) result.content = data.content;
  if (data.category !== undefined) result.category = data.category;
  if (data.tags !== undefined) result.tags = data.tags;
  if (data.createdAt !== undefined) result.createdAt = new Date(data.createdAt);
  if (data.updatedAt !== undefined) result.updatedAt = new Date(data.updatedAt);
  if (data.publishedAt !== undefined)
    result.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  if (data.isDraft !== undefined) result.isDraft = data.isDraft;
  if (data.pinned !== undefined) result.pinned = data.pinned;
  if (data.coverImage !== undefined) result.coverImage = data.coverImage ?? null;
  if (data.authorId !== undefined) result.authorId = data.authorId ?? null;
  if (data.authorName !== undefined) result.authorName = data.authorName ?? null;
  if (data.views !== undefined) result.views = data.views;
  if (data.likes !== undefined) result.likes = data.likes;
  if (data.favorites !== undefined) result.favorites = data.favorites;
  if (data.commentsCount !== undefined) result.commentsCount = data.commentsCount;
  return result;
}

/**
 * 创建文章记录
 * @param post 待写入的 Post
 * @param tx 可选事务客户端
 */
export async function createPostRecord(post: Post, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.create({ data: postToCreateData(post) });
}

/**
 * 更新文章记录
 * @param id 文章 id
 * @param data 部分更新数据
 * @param tx 可选事务客户端
 * @returns 更新后的 Post
 */
export async function updatePostRecord(id: string, data: PostUpdateData, tx?: Tx): Promise<Post> {
  const client = tx ?? getPrisma();
  const updated = await client.post.update({
    where: { id },
    data: postToUpdateData(data),
  });
  return mapToPost(updated);
}

/**
 * 删除文章记录
 * @param id 文章 id
 * @param tx 可选事务客户端
 */
export async function deletePostRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.delete({ where: { id } });
}

/**
 * 原子增减文章计数字段（浏览/点赞/收藏/评论数）
 * @param id 文章 id
 * @param field 计数字段名
 * @param delta 增量，可为负
 * @param tx 可选事务客户端
 * @returns 该字段增减后的最新值
 */
export async function incrementPostField(
  id: string,
  field: "views" | "likes" | "favorites" | "commentsCount",
  delta: number,
  tx?: Tx,
): Promise<number> {
  const client = tx ?? getPrisma();
  const updated = await client.post.update({
    where: { id },
    data: { [field]: { increment: delta } },
    select: { views: true, likes: true, favorites: true, commentsCount: true },
  });
  return updated[field];
}

/**
 * 按旧 id 查询迁移映射的新 id（PostIdMap 表）
 * @param oldId 旧文章 id
 * @returns 新 id，无映射时为 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  const map = await getPrisma().postIdMap.findUnique({ where: { oldId } });
  return map?.newId ?? null;
}

/**
 * 批量更新指定作者全部文章的 authorName 冗余字段
 * @param userId 作者用户 id
 * @param authorName 新作者名
 */
export async function updatePostAuthorName(userId: string, authorName: string): Promise<void> {
  await getPrisma().post.updateMany({
    where: { authorId: userId },
    data: { authorName },
  });
}

/**
 * 查询当前文章的前一篇/后一篇（仅已发布文章）
 * 排序键以 publishedAt 为准，未发布回退 createdAt；prev 为更早一篇，next 为更晚一篇
 * @param postId 当前文章 id
 * @param publishedAt 当前文章发布时间（ISO 字符串），可为 null
 * @param createdAt 当前文章创建时间（ISO 字符串）
 * @returns 相邻文章（不含正文），无则对应项为 null
 */
export async function findNeighborPosts(
  postId: string,
  publishedAt: string | null,
  createdAt: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const baseWhere = { isDraft: false, id: { not: postId } };
  const sortKey = publishedAt ?? createdAt;

  const [prevRow, nextRow] = await Promise.all([
    getPrisma().post.findFirst({
      where: {
        ...baseWhere,
        OR: [{ publishedAt: { lt: sortKey } }, { publishedAt: null, createdAt: { lt: createdAt } }],
      },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: POST_LIST_SELECT,
    }),
    getPrisma().post.findFirst({
      where: {
        ...baseWhere,
        OR: [{ publishedAt: { gt: sortKey } }, { publishedAt: null, createdAt: { gt: createdAt } }],
      },
      orderBy: [{ publishedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: POST_LIST_SELECT,
    }),
  ]);

  return {
    prev: prevRow ? mapToListPost(prevRow) : null,
    next: nextRow ? mapToListPost(nextRow) : null,
  };
}

/**
 * 轻量查询文章状态（id/是否草稿/作者），用于权限与互动前置判断，避免取全行
 * @param id 文章 id
 * @returns 状态对象，不存在时为 null
 */
export async function findPostStatus(
  id: string,
): Promise<{ id: string; isDraft: boolean; authorId: string | null } | null> {
  const post = await getPrisma().post.findUnique({
    where: { id },
    select: { id: true, isDraft: true, authorId: true },
  });
  return post ?? null;
}
