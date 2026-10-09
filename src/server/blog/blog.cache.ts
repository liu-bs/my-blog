import "server-only";

/**
 * @file 博客域缓存层
 * @description RSC 数据获取的缓存封装：用 Next "use cache" + cacheTag/cacheLife 对列表、详情、
 * 分类/标签等读路径做部分持久缓存；写路径经 invalidate 与 revalidate 系列函数按 tag 失效。
 * 缓存 key 由函数参数自动构成（同参数命中同条目），因此鉴权读（含用户信息）必须走不缓存的 *Internal 路径。
 */

import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";

import type {
  CategoriesData,
  CommentsListData,
  NeighborPostsData,
  PostData,
  PostListParams,
  PostsListData,
  TagsData,
} from "@shared";
import type { Post } from "@shared";
import { postPath } from "@shared";
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
import { listComments } from "@server/comment/comment.service";

/** 博客域全局缓存 tag 集合：列表、分类、标签 */
const BLOG_TAGS = ["posts", "categories", "tags"] as const;

/** 数据库瞬时故障后的重试等待时间，单位ms */
const DB_RETRY_DELAY_MS = 1500;

/**
 * 带一次重试的加载包装：用于抵御数据库瞬时连接故障
 * @param load 实际加载函数
 * @returns 加载结果
 * @throws 业务级 AppError 不重试直接抛出；其余错误重试一次后仍失败则抛出
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
 * 失效博客域全部读缓存（posts/categories/tags 三个全局 tag + 指定文章详情 tag）
 * @param postId 可选：额外失效该文章的 `post:${postId}` tag
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
 * 仅失效文章列表与单篇详情缓存（点赞/收藏/评论计数等轻量变更用，不动分类标签）
 * @param postId 文章 ID，对应 tag `post:${postId}`
 */
export function invalidatePostCache(postId: string): void {
  updateTag("posts");
  updateTag(`post:${postId}`);
}

/** 文章类缓存生命周期：5 分钟内可用陈旧数据，超 5 分钟后台再验证，硬过期 1 天 */
const POSTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

/** 分类/标签缓存生命周期：1 小时（低频变更，容忍更长的陈旧窗口） */
const TAXONOMY_LIFE = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;

/**
 * 将 URL 风格的列表参数归一化为 service 需要的类型
 * @description draft 是字符串 "true"（来自 searchParams），缓存 key 需基于归一化后的等价参数
 * @param params 原始列表参数
 * @returns draft 转 boolean、其余字段透传的查询参数
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
 * 鉴权版列表查询（不缓存）：结果依赖当前用户（草稿可见性等），不能进共享缓存
 * @param params 列表参数
 * @returns 分页文章列表数据
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
 * 匿名可见的列表查询缓存版："use cache" + tag "posts"，缓存 key 由归一化参数决定
 * @param params 列表参数（不含用户信息）
 * @returns 分页文章列表数据
 */
async function listPostsCached(params: PostListParams): Promise<PostsListData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return listPosts({ ...normalizeListParams(params), internal: true });
}

/**
 * RSC 文章列表入口：按场景选择缓存策略
 * @description withAuth=true 走鉴权不缓存；带关键词搜索 q 不缓存（结果集大且命中低）；其余走 tag 缓存
 * @param params 列表参数（分页、分类、标签、搜索词、草稿标记）
 * @param withAuth 是否按当前用户权限查询（草稿列表等场景）
 * @returns 分页文章列表数据
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
 * 按用户权限读取单篇文章（不缓存：草稿仅作者可见）
 * @param id 文章 ID
 * @returns 文章数据（正文已渲染为 HTML）
 * @throws NotFoundError——文章不存在或为草稿且访问者非作者
 */
export async function getPostServer(id: string): Promise<PostData> {
  const user = await getAuthPayload();
  const post = await getPost(id, user ?? undefined);
  return { post };
}

/**
 * 公开单篇文章缓存版："use cache" + tag `post:${id}`；404 吞掉返回 null（配合 generateStaticParams/ISR 容错）
 * @param id 文章 ID
 * @returns 文章数据；草稿或不存在时为 null；其余错误照常抛出
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
 * 公开首屏评论缓存版：与文章详情共用 `post:${postId}` tag，评论写操作会同时失效两者
 * @param postId 文章 ID
 * @param limit 拉取条数（offset 固定 0，缓存 key 即 postId+limit）
 * @returns 评论列表数据；加载失败返回 null 不阻断页面渲染
 */
export async function getPublicCommentsServer(
  postId: string,
  limit: number,
): Promise<CommentsListData | null> {
  "use cache";
  cacheTag(`post:${postId}`);
  cacheLife(POSTS_LIFE);
  return listComments({ postId, limit, offset: 0 }).catch(() => null);
}

/**
 * 上一篇/下一篇缓存版：tag "posts"，任何影响列表顺序的写操作都会使其失效
 * @param id 当前文章 ID
 * @returns prev/next 邻居文章数据
 */
export async function getNeighborPostsServer(id: string): Promise<NeighborPostsData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return getNeighborPosts(id);
}

/**
 * 分类列表缓存版：tag "categories"，1 小时生命周期
 * @returns 已发布文章的去重分类集合
 */
export async function getCategoriesServer(): Promise<CategoriesData> {
  "use cache";
  cacheTag("categories");
  cacheLife(TAXONOMY_LIFE);
  return { categories: await getCategoriesFromDb() };
}

/**
 * 标签列表缓存版：tag "tags"，1 小时生命周期
 * @returns 已发布文章标签及各自计数
 */
export async function getTagsServer(): Promise<TagsData> {
  "use cache";
  cacheTag("tags");
  cacheLife(TAXONOMY_LIFE);
  return { tags: await getTagsFromDb() };
}

/**
 * 我的收藏列表（不缓存：依赖当前用户）。未登录返回空列表而非抛错。
 * @returns 收藏文章的分页结构（一次性全量返回，不分页）
 */
export async function listFavoritePostsServer(): Promise<PostsListData> {
  const user = await getAuthPayload();
  if (!user) return { posts: [], total: 0, page: 1, limit: 0, totalPages: 0 };
  const posts = await listFavoritePosts(user.id);
  return { posts, total: posts.length, page: 1, limit: posts.length, totalPages: 1 };
}

/**
 * 当前用户草稿列表（走鉴权不缓存路径）
 * @returns 草稿分页数据；未登录时为空列表
 */
export async function listDraftsServer(): Promise<PostsListData> {
  return listPostsInternal({ draft: "true" });
}

/**
 * 指定作者的已发布文章列表（作者主页用，不缓存）
 * @param authorId 作者用户 ID
 * @returns 按置顶优先、发布时间倒序排列的文章列表
 */
export async function listPostsByAuthorServer(authorId: string): Promise<Post[]> {
  return listPostsByAuthor(authorId);
}

/** 文章 ID 变更映射查询：旧 ID（非法/历史格式）→ 新 ID（透传自 blog.service） */
export { findRenamedPostId } from "./blog.service";

/**
 * 触发文章详情页路由级再验证（配合 "use cache" 之外的页面 Router 缓存）
 * @param postId 文章 ID，路径由 postPath 统一生成
 */
export function revalidatePostPath(postId: string): void {
  revalidatePath(postPath(postId));
}
