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

const BLOG_TAGS = ["posts", "categories", "tags"] as const;

const DB_RETRY_DELAY_MS = 1500;

export async function withDbRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isAppError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
    return await load();
  }
}

export function invalidateBlogCache(postId?: string): void {
  for (const tag of BLOG_TAGS) {
    updateTag(tag);
  }
  if (postId) {
    updateTag(`post:${postId}`);
  }
}

export function invalidatePostCache(postId: string): void {
  updateTag("posts");
  updateTag(`post:${postId}`);
}

const POSTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

const TAXONOMY_LIFE = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;

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

async function listPostsInternal(params: PostListParams): Promise<PostsListData> {
  const user = await getAuthPayload();
  return listPosts({
    ...normalizeListParams(params),
    user: user ?? undefined,
    internal: true,
  });
}

export async function listPostsCached(params: PostListParams): Promise<PostsListData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return listPosts({ ...normalizeListParams(params), internal: true });
}

export async function listPostsServer(
  params: PostListParams = {},
  withAuth = false,
): Promise<PostsListData> {
  if (withAuth) return listPostsInternal(params);

  if (params.q) return listPosts({ ...normalizeListParams(params), internal: true });

  return listPostsCached(params);
}

export async function getPostServer(id: string): Promise<PostData> {
  const user = await getAuthPayload();
  const post = await getPost(id, user ?? undefined);
  return { post };
}

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

export async function getNeighborPostsServer(id: string): Promise<NeighborPostsData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return getNeighborPosts(id);
}

export async function getCategoriesServer(): Promise<CategoriesData> {
  "use cache";
  cacheTag("categories");
  cacheLife(TAXONOMY_LIFE);
  return { categories: await getCategoriesFromDb() };
}

export async function getTagsServer(): Promise<TagsData> {
  "use cache";
  cacheTag("tags");
  cacheLife(TAXONOMY_LIFE);
  return { tags: await getTagsFromDb() };
}

export async function listFavoritePostsServer(): Promise<PostsListData> {
  const user = await getAuthPayload();
  if (!user) return { posts: [], total: 0, page: 1, limit: 0, totalPages: 0 };
  const posts = await listFavoritePosts(user.id);
  return { posts, total: posts.length, page: 1, limit: posts.length, totalPages: 1 };
}

export async function listDraftsServer(): Promise<PostsListData> {
  return listPostsInternal({ draft: "true" });
}

export async function listPostsByAuthorServer(authorId: string): Promise<Post[]> {
  return listPostsByAuthor(authorId);
}

export { findRenamedPostId } from "./blog.service";

export function revalidatePostPathAllLocales(postId: string): void {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}${postPath(postId)}`);
  }
}
