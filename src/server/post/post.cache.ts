import "server-only";

import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";

import type {
  CategoryListData,
  NeighborPostsData,
  PostData,
  PostListParams,
  PostsListData,
  TagListData,
} from "@shared";
import { postPath } from "@shared";
import { getAuthPayload } from "@server/auth/auth.guard";
import { isAppErrorWithStatus } from "@server/common/errors";
import {
  getNeighborPosts,
  getPost,
  listCategories,
  listFavoritedPosts,
  listPosts,
  listTags,
  type ListPostsOptions,
} from "./post.service";

export { getRenamedPostId, listPostsByAuthor } from "./post.service";

const POSTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

const TAXONOMY_LIFE = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;

function toListOptions(params: PostListParams): ListPostsOptions {
  return {
    isDraft: params.draft === "true",
    category: params.category,
    tag: params.tag,
    q: params.q,
    page: params.page,
    limit: params.limit,
  };
}

export function invalidatePostsCache(postId?: string): void {
  updateTag("posts");
  updateTag("categories");
  updateTag("tags");
  if (postId) updateTag(`post:${postId}`);
}

export function invalidatePostCache(postId: string): void {
  updateTag("posts");
  updateTag(`post:${postId}`);
}

export function revalidatePostPath(postId: string): void {
  revalidatePath(postPath(postId));
}

export function revalidatePostListPaths(): void {
  revalidatePath("/", "page");
  revalidatePath("/posts", "page");
}

export async function listPostsCached(params: PostListParams = {}): Promise<PostsListData> {
  if (params.q) return listPosts(toListOptions(params));
  return listPostsPublic(params);
}

async function listPostsPublic(params: PostListParams): Promise<PostsListData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return listPosts(toListOptions(params));
}

async function listPostsWithViewer(params: PostListParams): Promise<PostsListData> {
  const viewer = await getAuthPayload();
  return listPosts({ ...toListOptions(params), viewer: viewer ?? undefined });
}

export async function listDraftsForViewer(): Promise<PostsListData> {
  return listPostsWithViewer({ draft: "true" });
}

export async function listFavoritedPostsForViewer(): Promise<PostsListData> {
  const viewer = await getAuthPayload();
  if (!viewer) return { posts: [], total: 0, page: 1, limit: 0, totalPages: 0 };

  const posts = await listFavoritedPosts(viewer.id);
  return { posts, total: posts.length, page: 1, limit: posts.length, totalPages: 1 };
}

export async function getPostForViewer(id: string): Promise<PostData> {
  const viewer = await getAuthPayload();
  const post = await getPost(id, viewer ?? undefined);
  return { post };
}

export async function getPostCached(id: string): Promise<PostData | null> {
  "use cache";
  cacheTag(`post:${id}`);
  cacheLife(POSTS_LIFE);

  const post = await getPost(id).catch((error: unknown) => {
    if (isAppErrorWithStatus(error, 404)) return null;
    throw error;
  });
  return post ? { post } : null;
}

export async function getNeighborPostsCached(id: string): Promise<NeighborPostsData> {
  "use cache";
  cacheTag("posts");
  cacheLife(POSTS_LIFE);
  return getNeighborPosts(id);
}

export async function listCategoriesCached(): Promise<CategoryListData> {
  "use cache";
  cacheTag("categories");
  cacheLife(TAXONOMY_LIFE);
  return { categories: await listCategories() };
}

export async function listTagsCached(): Promise<TagListData> {
  "use cache";
  cacheTag("tags");
  cacheLife(TAXONOMY_LIFE);
  return { tags: await listTags() };
}
