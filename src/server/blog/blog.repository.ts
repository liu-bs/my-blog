/**
 * @file blog.repository.ts
 * @description 文章领域的数据访问层（Repository）：封装 Post 表的 Prisma 查询与写入、
 * 列表条件组装、分类 / 标签聚合、上一篇 / 下一篇判定以及旧文章 ID 的映射查询。
 * 只负责数据读写，不含业务规则，事务由上层 Service 通过可选 tx 参数传入
 */
import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import type { Post } from "@shared";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：既可以是普通 PrismaClient，也可以是 $transaction 回调注入的事务客户端，使一批写操作共享同一事务边界 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Post 表的行结构：与 Prisma 返回值对齐，时间字段为 Date（对外领域模型会转成 ISO 字符串） */
type PrismaPost = {
  /** 主键，形如 `<时间戳>-<随机串>` */
  id: string;
  /** 标题 */
  title: string;
  /** 摘要，用于列表展示与 SEO */
  summary: string;
  /** Markdown 正文原文 */
  content: string;
  /** 分类，单值 */
  category: string;
  /** 标签数组 */
  tags: string[];
  /** 创建时间 */
  createdAt: Date;
  /** 最近更新时间 */
  updatedAt: Date;
  /** 发布时间，草稿为 null */
  publishedAt: Date | null;
  /** 是否为草稿 */
  isDraft: boolean;
  /** 是否置顶，草稿始终为 false */
  pinned: boolean;
  /** 封面图 URL，可为空 */
  coverImage: string | null;
  /** 作者用户 ID，作者注销后可为 null */
  authorId: string | null;
  /** 作者展示名快照，冗余存储以避免每次列表查询都联表 User */
  authorName: string | null;
  /** 浏览量 */
  views: number;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 评论数 */
  commentsCount: number;
};

/** 把数据库的 Date 统一转成 ISO 8601 字符串，作为对外 Post 类型的时间表示 */
function iso(d: Date): string {
  return d.toISOString();
}

/**
 * 将 Prisma 行映射为对外领域模型 {@link Post}
 * @description 主要做两件事：Date → ISO 字符串；数据库中的 null 归一化为 undefined，
 * 让可选字段在 JSON 序列化后直接消失，与前端的可选类型约定一致
 * @param p Prisma 查询返回的完整 Post 行
 * @returns 领域层 Post 对象
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

/** 列表查询的字段集合：刻意不选 content，避免列表接口把可能很大的正文一并取出，列表侧 content 统一按空串处理 */
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

/** 列表行结构：即不含 content 的 Post 行 */
type PrismaPostList = Omit<PrismaPost, "content">;

/** 列表行映射：补一个空 content 复用完整映射逻辑 */
function mapToListPost(p: PrismaPostList): Post {
  return mapToPost({ ...p, content: "" });
}

/**
 * 文章查询条件（Repository 内部使用的领域化入参）
 * @description 由 Service 组装，buildPrismaWhere 再翻译为 Prisma 的 where 结构；
 * 各字段均为可选，未提供即不参与过滤
 */
export interface PostQueryOptions {
  /** 按草稿状态过滤：false 取已发布，true 取草稿 */
  isDraft?: boolean;
  /** 按作者过滤 */
  authorId?: string;
  /** 按分类过滤（精确匹配） */
  category?: string;
  /** 按标签过滤（数组包含该标签） */
  tag?: string;
  /** 全文关键字，同时匹配标题与正文 */
  q?: string;
  /** 按 ID 集合过滤，用于批量取文章（如收藏列表） */
  ids?: string[];
  /** 排序字段与方向 */
  orderBy?: { field: "publishedAt" | "createdAt" | "updatedAt"; direction: "asc" | "desc" };
  /** 是否置顶优先（置顶排在最前） */
  pinnedFirst?: boolean;
  /** 分页偏移量 */
  skip?: number;
  /** 单页数量上限 */
  take?: number;
}

/**
 * 按 ID 查询单篇文章（含正文）
 * @param id 文章 ID
 * @returns 领域模型 Post；不存在时返回 null，由上层决定是否抛 NotFoundError
 */
export async function findPostById(id: string): Promise<Post | null> {
  const post = await getPrisma().post.findUnique({ where: { id } });
  return post ? mapToPost(post) : null;
}

/**
 * 把领域化查询条件翻译成 Prisma 的 where 结构
 * @description 约定「undefined / 空值即不过滤」；关键字搜索对标题与正文做不区分大小写的 contains，
 * 二者以 OR 组合，命中其一即可
 * @param where Repository 层的查询条件
 * @returns Prisma 的 PostWhereInput
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
 * 查询文章列表（不含正文）
 * @description 排序规则：置顶优先时先按 pinned 倒序；主排序字段缺省为 publishedAt 倒序，
 * 且对 publishedAt 采用 nulls last——未发布记录排在已发布之后。分页参数仅在显式传入时才下推到 SQL
 * @param where 查询条件与分页 / 排序设置
 * @returns 领域模型 Post 数组（content 为空串）
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
 * 统计满足条件的文章总数，供分页计算总页数
 * @param where 与 findPosts 相同的过滤条件（不含排序 / 分页）
 * @returns 匹配记录数
 */
export async function countPosts(where: PostQueryOptions): Promise<number> {
  return getPrisma().post.count({ where: buildPrismaWhere(where) });
}

/**
 * 取全部已发布文章的分类集合
 * @description 用 distinct 从 Post 表直接去重取分类，未单独建分类表；草稿不参与分类展示
 * @returns 去重后的分类名数组（已过滤空值）
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
 * 取全部已发布文章的标签及各自出现次数
 * @description 标签以字符串数组存在 Post.tags 上，Prisma 无法直接聚合，故用原生 SQL 的 unnest 把数组展开后再 GROUP BY。
 * 仅统计已发布文章，按标签名排序
 * @returns 形如 `[{ name, count }]` 的标签统计；count 由 bigint 转成 number
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

/** 将领域模型 Post 转成 Prisma 创建入参：可选字段补默认值（pinned=false、计数=0、可空字段=null） */
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
 * 文章更新入参
 * @description 全部字段可选，仅实际传入的字段会被写库（见 postToUpdateData），
 * 因此可安全地支持「只更新部分列」；publishedAt 允许显式置 null 以表示退回草稿
 */
export type PostUpdateData = Partial<{
  /** 标题 */
  title: string;
  /** 摘要 */
  summary: string;
  /** Markdown 正文 */
  content: string;
  /** 分类 */
  category: string;
  /** 标签数组 */
  tags: string[];
  /** 创建时间（ISO，一般不改） */
  createdAt: string;
  /** 更新时间（ISO） */
  updatedAt: string;
  /** 发布时间（ISO）；置为 null 表示清空发布时间（转回草稿） */
  publishedAt: string | null;
  /** 草稿状态 */
  isDraft: boolean;
  /** 是否置顶 */
  pinned: boolean;
  /** 封面图；null 表示清除封面 */
  coverImage: string | null;
  /** 作者 ID；null 表示解绑作者 */
  authorId: string | null;
  /** 作者名快照；null 表示清空 */
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

/**
 * 将更新入参转成 Prisma 的 update data
 * @description 逐字段判 `!== undefined`，只有显式传入的字段才进入结果对象，
 * 从而让 Prisma 只 SET 变化的列；时间字段在此处由 ISO 字符串还原为 Date
 * @param data 领域化更新入参
 * @returns Prisma 的 PostUncheckedUpdateInput
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
 * 写入一条新文章
 * @param post 领域模型 Post
 * @param tx 可选事务客户端；传入时与调用方共享事务，保证「建文章 + 更新作者统计」原子生效
 */
export async function createPostRecord(post: Post, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.create({ data: postToCreateData(post) });
}

/**
 * 更新文章并返回更新后的领域模型
 * @param id 文章 ID
 * @param data 待更新字段（仅显式传入的列会被写库）
 * @param tx 可选事务客户端
 * @returns 更新后的领域模型 Post
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
 * 删除文章
 * @param id 文章 ID
 * @param tx 可选事务客户端
 */
export async function deletePostRecord(id: string, tx?: Tx): Promise<void> {
  const client = tx ?? getPrisma();
  await client.post.delete({ where: { id } });
}

/**
 * 对单个数值列做原子增减
 * @description 直接用数据库的 increment 而非「先读后写」，避免并发点赞 / 浏览量计数丢失；
 * 通过 select 回传最新计数值供接口返回
 * @param id 文章 ID
 * @param field 目标计数字段
 * @param delta 增量，可为负数（取消点赞时传 -1）
 * @param tx 可选事务客户端
 * @returns 自增 / 自减后该字段的最新值
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
 * 查询旧 ID 对应的新文章 ID
 * @description 文章 ID 规则曾发生迁移，历史链接里的旧 ID 通过 PostIdMap 表映射到当前 ID，用于兼容旧分享链接 / 搜索引擎收录
 * @param oldId 历史文章 ID
 * @returns 映射到的新 ID；无映射时返回 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  const map = await getPrisma().postIdMap.findUnique({ where: { oldId } });
  return map?.newId ?? null;
}

/**
 * 同步刷新某个作者名下所有文章的作者名快照
 * @description authorName 是冗余字段，用户改名后需要批量回填，避免逐篇更新
 * @param userId 作者用户 ID
 * @param authorName 新的作者展示名
 */
export async function updatePostAuthorName(userId: string, authorName: string): Promise<void> {
  await getPrisma().post.updateMany({
    where: { authorId: userId },
    data: { authorName },
  });
}

/**
 * 查询文章的上一篇 / 下一篇（仅针对已发布文章）
 * @description 判定依据是文章在「发布列表」中的先后位置：以 publishedAt 为主键、createdAt 兜底
 * （历史数据或异常情况下可能没有 publishedAt）。prev 取排序键小于当前文章中最靠后的一篇，
 * next 取大于当前文章中最靠前的一篇；publishedAt 为 null 的记录用 createdAt 参与比较并排在最后
 * @param postId 当前文章 ID，需从结果中排除
 * @param publishedAt 当前文章的发布时间，草稿/未发布为 null
 * @param createdAt 当前文章的创建时间，作为 publishedAt 缺失时的比较基准
 * @returns `{ prev, next }`，两端无相邻文章时为 null
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
 * 只取文章的阅读状态相关字段
 * @description 点赞 / 收藏 / 评论 / 浏览量等高频操作只需判断「是否存在、是否草稿、作者是谁」，
 * 用最小 select 降低开销，避免拉取正文
 * @param id 文章 ID
 * @returns `{ id, isDraft, authorId }`；文章不存在时返回 null
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
