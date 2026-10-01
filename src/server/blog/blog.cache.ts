/**
 * @file blog.cache.ts
 * @description 博客数据的 'use cache' 缓存层与失效策略。读路径按 cacheTag（posts/categories/
 * tags/post:<id>）+ cacheLife 缓存；写路径按场景选择失效范围：内容增删改用 invalidateBlogCache
 * 全量失效，点赞/收藏等互动用 invalidatePostCache 仅失效列表与单篇（有意缩小失效范围，避免误伤分类/标签缓存）。
 * 登录态相关与搜索请求不走缓存；withDbRetry 兜底 Neon serverless 冷启动失败。
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

/** 博客缓存的基础标签集合（文章列表/分类/标签） */
const BLOG_TAGS = ["posts", "categories", "tags"] as const;

/** 数据库冷启动重试前的等待时长，单位毫秒 */
const DB_RETRY_DELAY_MS = 1500;

/**
 * 带一次重试的数据库读取包装，用于容忍 Neon 冷启动瞬断
 * AppError（业务错误）直接上抛不重试，仅对基础设施类错误等待 1.5s 后重试一次
 * @param load 数据加载函数
 * @returns 加载结果
 * @throws 重试后仍失败时抛出原始错误
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
 * 全量失效博客缓存（内容增删改场景）
 * 失效 posts/categories/tags 全部基础标签；传入 postId 时额外失效该篇的 post:<id> 标签
 * @param postId 可选，发生变更的文章 id
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
 * 小范围失效文章缓存（点赞/收藏等互动场景）
 * 仅失效 posts 列表与单篇 post:<id>，不触碰 categories/tags——互动不影响分类/标签数据，
 * 缩小失效范围是有意为之，减少无关缓存重建
 * @param postId 发生互动的文章 id
 */
export function invalidatePostCache(postId: string): void {
  updateTag("posts");
  updateTag(`post:${postId}`);
}

/** 文章类缓存的存活策略：stale/revalidate 各 5 分钟，最长 1 天 */
const POSTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

/** 分类/标签等低频变化数据的存活策略：stale/revalidate 各 1 小时，最长 1 天 */
const TAXONOMY_LIFE = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;

/**
 * 将 URL 查询参数规整为服务层列表入参（draft 字符串转布尔，其余原样透传）
 * @param params 原始列表参数
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
 * 携带登录态的文章列表读取（不缓存）
 * 先解析当前用户再透传给服务层，保证草稿/私密文章的可见性按请求者判定
 * @param params 列表参数
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
 * 匿名文章列表的缓存版读取（use cache，tag=posts）
 * 注意边界内不解析登录态，仅用于公开列表
 * @param params 列表参数
 */
export async function listPostsCached(params: PostListParams): Promise<PostsListData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return listPosts({ ...normalizeListParams(params), internal: true });
}

/**
 * 文章列表统一读入口
 * 携带登录态（withAuth）或搜索请求（q）时绕过缓存实时查询，其余走 listPostsCached
 * @param params 列表参数
 * @param withAuth 是否需要按当前登录用户判定可见性
 * @returns 文章列表数据
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
 * 按登录态读取单篇文章（不缓存）
 * 登录用户可见草稿/私密文章，匿名用户按公开规则判定
 * @param id 文章 id
 * @returns 包含 post 的数据结构
 * @throws 文章不可见时由服务层抛出 NotFoundError 等业务错误
 */
export async function getPostServer(id: string): Promise<PostData> {
  const user = await getAuthPayload();
  const post = await getPost(id, user ?? undefined);
  return { post };
}

/**
 * 匿名单篇文章的缓存版读取（use cache，tag=post:<id>）
 * 404 在缓存边界内 catch 转 null——'use cache' 返回值经结构化克隆序列化，
 * 自定义 Error 属性会被剥掉，因此不可见文章以 null 表达而非抛错
 * @param id 文章 id
 * @returns 文章数据，不存在/不可见时为 null
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
 * 相邻文章（上一篇/下一篇）的缓存版读取（use cache，tag=posts）
 * @param id 当前文章 id
 */
export async function getNeighborPostsServer(id: string): Promise<NeighborPostsData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return getNeighborPosts(id);
}

/** 文章分类列表的缓存版读取（use cache，tag=categories） */
export async function getCategoriesServer(): Promise<CategoriesData> {
  "use cache";
  cacheTag("categories");
  cacheLife(TAXONOMY_LIFE);
  return { categories: await getCategoriesFromDb() };
}

/** 文章标签列表的缓存版读取（use cache，tag=tags） */
export async function getTagsServer(): Promise<TagsData> {
  "use cache";
  cacheTag("tags");
  cacheLife(TAXONOMY_LIFE);
  return { tags: await getTagsFromDb() };
}

/**
 * 当前用户收藏文章列表（不缓存，登录态相关）
 * 未登录返回空列表结构
 */
export async function listFavoritePostsServer(): Promise<PostsListData> {
  const user = await getAuthPayload();
  if (!user) return { posts: [], total: 0, page: 1, limit: 0, totalPages: 0 };
  const posts = await listFavoritePosts(user.id);
  return { posts, total: posts.length, page: 1, limit: posts.length, totalPages: 1 };
}

/** 当前用户草稿列表（不缓存，按登录态判定） */
export async function listDraftsServer(): Promise<PostsListData> {
  return listPostsInternal({ draft: "true" });
}

/** 指定作者的公开文章列表（不缓存，作者主页用） */
export async function listPostsByAuthorServer(authorId: string): Promise<Post[]> {
  return listPostsByAuthor(authorId);
}

export { findRenamedPostId } from "./blog.service";

/**
 * 失效指定文章在所有语言下的页面路径（generateStaticParams 产出的本地化路由）
 * @param postId 文章 id
 */
export function revalidatePostPathAllLocales(postId: string): void {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}${postPath(postId)}`);
  }
}
