import "server-only";

/**
 * @file 博客域数据仓库层
 * @description 只负责 Prisma 读写与 Prisma 模型 → @shared Post 的形状映射（Date → ISO 字符串、null → undefined），
 * 不包含任何业务判断。列表查询统一用 POST_LIST_SELECT 排除正文大字段；写函数均接受可选 tx 事务客户端，
 * 由 service 层决定事务边界。
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { Post } from "@shared";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：既可传全局 PrismaClient，也可传 $transaction 回调内的 tx */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Post 表完整行的结构（含正文，用于详情查询映射）
 */
type PrismaPost = {
  /** 文章唯一ID */
  id: string;

  /** 标题 */
  title: string;

  /** 摘要（列表展示用） */
  summary: string;

  /** Markdown 原文 */
  content: string;

  /** 分类名 */
  category: string;

  /** 标签数组 */
  tags: string[];

  /** 创建时间 */
  createdAt: Date;

  /** 最后更新时间 */
  updatedAt: Date;

  /** 发布时间，草稿为 null */
  publishedAt: Date | null;

  /** 是否草稿 */
  isDraft: boolean;

  /** 是否置顶 */
  pinned: boolean;

  /** 封面图 URL，可为 null */
  coverImage: string | null;

  /** 作者用户 ID，可为 null（历史/迁移数据） */
  authorId: string | null;

  /** 作者展示名冗余字段，随资料变更同步 */
  authorName: string | null;

  /** 浏览量 */
  views: number;

  /** 点赞数 */
  likes: number;

  /** 收藏数 */
  favorites: number;

  /** 评论数（冗余计数，写路径同事务维护） */
  commentsCount: number;
};

/** Date → ISO 字符串 */
function iso(d: Date): string {
  return d.toISOString();
}

/**
 * Prisma 完整行 → shared Post：Date 转 ISO，null 归一为 undefined
 * @param p Prisma 查询结果行
 * @returns shared Post 对象
 */
function mapToPost(p: PrismaPost): Post {
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

/** 列表查询字段选择：刻意排除 content 大字段，降低列表查询负载 */
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

/** 列表查询返回的行结构（PrismaPost 去掉 content） */
type PrismaPostList = Omit<PrismaPost, "content">;

/** 列表行 → Post：content 补空串，调用方不应依赖列表结果的正文 */
function mapToListPost(p: PrismaPostList): Post {
  return mapToPost({ ...p, content: "" });
}

/**
 * 文章列表查询条件
 */
interface PostQueryOptions {
  /** 草稿过滤：true 只查草稿，false 只查已发布，undefined 不过滤 */
  isDraft?: boolean;

  /** 按作者 ID 过滤 */
  authorId?: string;

  /** 按分类名过滤 */
  category?: string;

  /** 按标签过滤（数组包含匹配） */
  tag?: string;

  /** 关键词搜索：标题或正文模糊匹配（不区分大小写） */
  q?: string;

  /** 按 ID 集合过滤（收藏列表等场景） */
  ids?: string[];

  /** 排序字段与方向，缺省按 publishedAt 倒序 */
  orderBy?: { field: "publishedAt" | "createdAt" | "updatedAt"; direction: "asc" | "desc" };

  /** 是否置顶优先（pinned desc 作为第一排序键） */
  pinnedFirst?: boolean;

  /** 分页偏移量 */
  skip?: number;

  /** 每页条数 */
  take?: number;
}

/**
 * 按 ID 查询单篇文章完整记录
 * @param id 文章 ID
 * @returns shared Post；不存在时 null
 */
export async function findPostById(id: string): Promise<Post | null> {
  const post = await getPrisma().post.findUnique({ where: { id } });
  return post ? mapToPost(post) : null;
}

/**
 * 将 PostQueryOptions 翻译为 Prisma where 条件（q 走 title/content OR 模糊匹配）
 * @param where 仓库层查询条件
 * @returns Prisma PostWhereInput
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
 * 文章列表查询：按条件过滤 + 排序 + 分页，不返回正文
 * @param where 查询条件（见 PostQueryOptions）
 * @returns 排序后的文章列表（content 为空串）
 */
export async function findPosts(where: PostQueryOptions): Promise<Post[]> {
  const orderBy: Prisma.PostOrderByWithRelationInput[] = [];
  if (where.pinnedFirst) orderBy.push({ pinned: "desc" });

  const sortField = where.orderBy?.field ?? "publishedAt";
  const sortDir = where.orderBy?.direction ?? "desc";

  // publishedAt 排序时把草稿的 null 值沉底，避免置顶/时间线错乱
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
 * 与 findPosts 相同条件的总数统计（分页 totalPages 用）
 * @param where 查询条件
 * @returns 匹配的文章数
 */
export async function countPosts(where: PostQueryOptions): Promise<number> {
  return getPrisma().post.count({ where: buildPrismaWhere(where) });
}

/**
 * 已发布文章的分类去重列表（分类侧边栏/筛选器用）
 * @returns 分类名字符串数组，过滤空值
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
 * 已发布文章的标签计数聚合：unnest tags 数组后 GROUP BY
 * @returns 按标签名排序的 { name, count } 列表（PG bigint 映射为 number）
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

/** shared Post → Prisma 未检查创建入参：ISO 字符串转 Date，缺省数值字段补 0 */
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
 * 文章局部更新的数据形状：undefined 表示"不修改该字段"，时间统一用 ISO 字符串传入
 */
export type PostUpdateData = Partial<{
  /** 标题 */
  title: string;

  /** 摘要 */
  summary: string;

  /** Markdown 正文 */
  content: string;

  /** 分类名 */
  category: string;

  /** 标签数组 */
  tags: string[];

  /** 创建时间（ISO 字符串） */
  createdAt: string;

  /** 更新时间（ISO 字符串） */
  updatedAt: string;

  /** 发布时间（ISO 字符串），null 表示撤回草稿 */
  publishedAt: string | null;

  /** 是否草稿 */
  isDraft: boolean;

  /** 是否置顶 */
  pinned: boolean;

  /** 封面图 URL */
  coverImage: string | null;

  /** 作者用户 ID */
  authorId: string | null;

  /** 作者展示名 */
  authorName: string | null;

  /** 浏览量 */
  views: number;

  /** 点赞数 */
  likes: number;

  /** 收藏数 */
  favorites: number;

  /** 评论数 */
  commentsCount: number;
}>;

/** 过滤 undefined 字段生成 Prisma update data（PATCH 语义落到数据库层） */
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
 * 插入文章记录
 * @param post 完整 Post（ID 由 service 生成）
 * @param tx 可选事务客户端；不传则独立提交
 */
export async function createPostRecord(post: Post, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.create({ data: postToCreateData(post) });
}

/**
 * 按 ID 局部更新文章并返回更新后的完整记录
 * @param id 文章 ID
 * @param data 局部更新数据（undefined 字段跳过）
 * @param tx 可选事务客户端
 * @returns 更新后的 Post
 * @throws Prisma P2025——文章不存在时由 Prisma 抛出，service 层已先行存在性校验
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
 * 按 ID 物理删除文章（关联评论/点赞表依赖数据库级联或约束处理）
 * @param id 文章 ID
 * @param tx 可选事务客户端
 */
export async function deletePostRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.delete({ where: { id } });
}

/**
 * 原子增减文章计数字段（views/likes/favorites/commentsCount）
 * @param id 文章 ID
 * @param field 计数字段名
 * @param delta 增量，可为负数
 * @param tx 可选事务客户端
 * @returns 更新后的该字段最新值（供接口直接返回计数）
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
 * 查询历史 ID 重命名映射（旧格式 ID → 新格式 ID）
 * @param oldId 旧文章 ID
 * @returns 映射的新 ID；无映射时 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  const map = await getPrisma().postIdMap.findUnique({ where: { oldId } });
  return map?.newId ?? null;
}

/**
 * 批量同步某作者所有文章的展示名冗余字段（用户改名后由 service 级联调用）
 * @param userId 作者 ID
 * @param authorName 新展示名
 */
export async function updatePostAuthorName(userId: string, authorName: string): Promise<void> {
  await getPrisma().post.updateMany({
    where: { authorId: userId },
    data: { authorName },
  });
}

/**
 * 查询时间线上的上一篇/下一篇（仅已发布，排除自身）
 * @param postId 当前文章 ID
 * @param publishedAt 当前文章发布时间，草稿传 null
 * @param createdAt 当前文章创建时间（publishedAt 为 null 时的排序回退键）
 * @returns prev（更早一篇）与 next（更晚一篇），不存在则为 null；均不含正文
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
 * 轻量状态查询：只取鉴权/计数需要的 id、isDraft、authorId 三列
 * @param id 文章 ID
 * @returns 状态对象；不存在时 null
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
