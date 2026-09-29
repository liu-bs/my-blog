/**
 * @file blog.cache.ts
 * @description 文章读缓存的统一出口：用 Next.js 16 的 `use cache` + cacheTag / cacheLife 对列表、
 * 详情、分类标签等读接口做缓存，并在写操作后按 tag 精确失效；另提供数据库读的轻量重试与全语言路径 revalidate。
 * 页面 / Server Component 只从这里取数据，不直接调用 service，以复用缓存策略
 */
import "server-only";

import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";

import type {
  CategoriesData,
  NeighborPostsData,
  PostData,
  PostListParams,
  PostsListData,
  TagsData,
} from "@shared";
import type { Post } from "@shared";
import { postPath } from "@shared";
import { routing } from "@/i18n/routing";
import {
  listPosts,
  getPost,
  listFavoritePosts,
  listPostsByAuthor,
  getNeighborPosts,
} from "./blog.service";
import { getCategoriesFromDb, getTagsFromDb } from "./blog.repository";
import { getAuthPayload } from "@server/auth/auth.service";
import { isAppError, isAppErrorWithStatus } from "@server/common/errors";

/** 文章相关缓存的 tag 集合：任一文章发生写操作时整体失效，用于粗粒度刷新列表与分类 / 标签聚合 */
const BLOG_TAGS = ["posts", "categories", "tags"] as const;

/** 数据库瞬时抖动的重试间隔，单位毫秒 */
const DB_RETRY_DELAY_MS = 1500;

/**
 * 带一次重试地执行数据库读取
 * @description 专为 Serverless + 无服务器 Postgres（Neon）冷启动 / 连接抖动设计：首次失败后等待固定间隔再试一次。
 * 业务错误（AppError，如 NotFound）直接抛出，不重试——因为重试也改变不了结果，只会增加延迟
 * @param load 触发一次数据库读取的工厂函数
 * @returns 读取结果；两次都失败则抛出最后一次的异常
 */
export async function withDbRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isAppError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
    return await load();
  }
}

/**
 * 文章写操作后的粗粒度缓存失效
 * @description 失效 posts / categories / tags 三个 tag（列表、分类、标签聚合都可能受影响），
 * 若给了 postId 再额外失效该文章详情缓存。updateTag 是 Next.js 16 的按 tag 立即失效 API
 * @param postId 受影响的文章 ID，可选；仅详情变更时才需要传
 */
export function invalidateBlogCache(postId?: string): void {
  for (const tag of BLOG_TAGS) {
    updateTag(tag);
  }
  if (postId) {
    updateTag(`post:${postId}`);
  }
}

/**
 * 单篇文章的缓存失效
 * @description 点赞 / 收藏等交互只影响该文章详情与列表中的计数字段，保守地一并失效 posts 与 post:<id> 两个 tag
 * @param postId 文章 ID
 */
export function invalidatePostCache(postId: string): void {
  updateTag("posts");
  updateTag(`post:${postId}`);
}

/** 文章类缓存生命周期：stale / revalidate 5 分钟，每日过期一次（单位秒） */
const POSTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

/** 分类 / 标签等低频变更数据的生命周期：1 小时刷新，每日过期（单位秒） */
const TAXONOMY_LIFE = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;

/**
 * 把 URL 查询参数（字符串）归一化为 service 需要的列表入参
 * @description draft 从字符串 "true" 转成布尔；其余字段原样透传，undefined 会被 service 视为不过滤
 * @param params 来自 URL 的列表查询参数
 * @returns 归一化后的列表查询条件
 */
function normalizeListParams(params: PostListParams) {
  return {
    draft: params.draft === "true",
    category: params.category,
    tag: params.tag,
    q: params.q,
    page: params.page,
    limit: params.limit,
  };
}

/**
 * 需要登录态的列表查询（带权限视角，不缓存）
 * @description 草稿列表与「我的」视角依赖当前用户，结果因人而异，故走非缓存路径并携带 user
 * @param params 列表查询参数
 * @returns 分页结果
 */
async function listPostsInternal(params: PostListParams): Promise<PostsListData> {
  const user = await getAuthPayload();
  return listPosts({
    ...normalizeListParams(params),
    user: user ?? undefined,
    internal: true,
  });
}

/**
 * 缓存的公开文章列表
 * @description 通过 `use cache` 指令把结果写入 Next.js 数据缓存，并以 posts tag 标记以便写后失效。
 * 只承载匿名视角数据，因此不携带 user
 * @param params 列表查询参数
 * @returns 分页结果
 */
export async function listPostsCached(params: PostListParams): Promise<PostsListData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return listPosts({ ...normalizeListParams(params), internal: true });
}

/**
 * 文章列表的服务端统一入口，按需选择缓存策略
 * @description 分流规则：带登录态（withAuth，如个人草稿 / 收藏）或带搜索关键字 q 时直连数据库，
 * 因为前者因人而异、后者基数大命中率低；其余公开列表走缓存
 * @param params 列表查询参数
 * @param withAuth 是否按当前用户视角查询
 * @returns 分页结果
 */
export async function listPostsServer(
  params: PostListParams = {},
  withAuth = false,
): Promise<PostsListData> {
  if (withAuth) return listPostsInternal(params);

  if (params.q) return listPosts({ ...normalizeListParams(params), internal: true });

  return listPostsCached(params);
}

/**
 * 查询文章详情（含当前用户视角，不缓存）
 * @description 编辑态或需按用户判断草稿可见性时使用，必须最新数据
 * @param id 文章 ID
 * @returns `{ post }`
 */
export async function getPostServer(id: string): Promise<PostData> {
  const user = await getAuthPayload();
  const post = await getPost(id, user ?? undefined);
  return { post };
}

/**
 * 查询公开文章详情（缓存）
 * @description 匿名视角的详情缓存，以 post:<id> 为 tag；文章不存在（404）时缓存 null，
 * 其余异常照常抛出，避免把真实故障当成「不存在」
 * @param id 文章 ID
 * @returns `{ post }`；不存在时返回 null
 */
export async function getPublicPostServer(id: string): Promise<PostData | null> {
  "use cache";
  cacheTag(`post:${id}`);
  cacheLife(POSTS_LIFE);
  const post = await getPost(id).catch((error: unknown) => {
    if (isAppErrorWithStatus(error, 404)) return null;
    throw error;
  });
  return post ? { post } : null;
}

/**
 * 查询上一篇 / 下一篇（缓存）
 * @description 相邻文章会随任一新文章发布而变化，故与列表共用 posts tag
 * @param id 文章 ID
 * @returns `{ prev, next }`
 */
export async function getNeighborPostsServer(id: string): Promise<NeighborPostsData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return getNeighborPosts(id);
}

/**
 * 查询全部分类（缓存）
 * @description 分类来自已发布文章去重，变更频率低，使用更长生命周期
 * @returns `{ categories }`
 */
export async function getCategoriesServer(): Promise<CategoriesData> {
  "use cache";
  cacheTag("categories");
  cacheLife(TAXONOMY_LIFE);
  return { categories: await getCategoriesFromDb() };
}

/**
 * 查询全部标签及其文章数（缓存）
 * @description 标签统计基于全量已发布文章聚合，开销较大且变更不频繁，适合缓存
 * @returns `{ tags }`
 */
export async function getTagsServer(): Promise<TagsData> {
  "use cache";
  cacheTag("tags");
  cacheLife(TAXONOMY_LIFE);
  return { tags: await getTagsFromDb() };
}

/**
 * 查询当前用户的收藏列表（不缓存）
 * @description 结果因人而异，不进入缓存；未登录时返回空列表。
 * 收藏是全量返回的一次性列表，故 page / limit / totalPages 用实际长度填充
 * @returns 分页结构包裹的收藏文章列表
 */
export async function listFavoritePostsServer(): Promise<PostsListData> {
  const user = await getAuthPayload();
  if (!user) return { posts: [], total: 0, page: 1, limit: 0, totalPages: 0 };
  const posts = await listFavoritePosts(user.id);
  return { posts, total: posts.length, page: 1, limit: posts.length, totalPages: 1 };
}

/**
 * 查询当前用户的草稿列表（不缓存）
 * @description 草稿属于私密数据，必须带登录态实时查询
 * @returns 分页结果
 */
export async function listDraftsServer(): Promise<PostsListData> {
  return listPostsInternal({ draft: "true" });
}

/**
 * 查询指定作者的公开文章（不缓存）
 * @description 作者主页使用；数据量随作者而变，且需保证主页实时性，暂不缓存
 * @param authorId 作者用户 ID
 * @returns 该作者的已发布文章列表
 */
export async function listPostsByAuthorServer(authorId: string): Promise<Post[]> {
  return listPostsByAuthor(authorId);
}

export { findRenamedPostId } from "./blog.service";

/**
 * 失效某篇文章在所有语言下的路径缓存
 * @description 站点是 next-intl 双语（zh / en），文章路径带 locale 前缀且各语言各有一份路由缓存，
 * 只 revalidatePath 当前语言会残留另一语言的旧页面，故遍历 routing.locales 逐个 revalidatePath
 * @param postId 文章 ID
 */
export function revalidatePostPathAllLocales(postId: string): void {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}${postPath(postId)}`);
  }
}
