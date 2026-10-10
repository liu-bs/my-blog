import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";

import type {
  AuthPayload,
  CreatePostDto,
  FavoriteToggleData,
  LikeToggleData,
  NeighborPostsData,
  Post,
  PostTagCount,
  PostsListData,
  UpdatePostDto,
  UserPostAssociation,
} from "@shared";
import {
  IMAGE_URL_INVALID_MESSAGE,
  assertValidPostId,
  isSafeImageUrl,
  isValidPostId,
} from "@shared";
import { stripMarkdown } from "@shared/markdown";
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "@server/common/errors";
import { logger } from "@server/common/logger";
import { PAGE_LIMITS } from "@server/common/policy";
import { runInTransaction } from "@server/common/db";
import {
  getUserById,
  getUserDisplayName,
  getUserWithPostAssociations,
  incrementUserStat,
  toggleUserPostAssociation,
} from "@server/user/user.service";
import { renderPostBody } from "./post.render";
import type { PostStatus, PostUpdateData } from "./post.repository";
import {
  countPosts,
  createPostRecord,
  deletePostRecord,
  findNeighborPosts,
  findPostById,
  findPostStatus,
  listPostsByQuery,
  findRenamedPostId,
  incrementPostCounter,
  listDistinctCategories,
  listTagCounts,
  updatePostRecord,
} from "./post.repository";

export { updatePostsAuthorName } from "./post.repository";

export interface ListPostsOptions {
  isDraft?: boolean;

  viewer?: AuthPayload;

  category?: string;

  tag?: string;

  q?: string;

  page?: number;

  limit?: number;
}

const SUMMARY_MAX_LENGTH = 100;

function buildSummary(content: string): string {
  const plainText = stripMarkdown(content)
    .replace(/\n{2,}/g, " ")
    .trim();
  if (!plainText) return "(No content summary)";
  const summary = plainText.slice(0, SUMMARY_MAX_LENGTH);
  return plainText.length > SUMMARY_MAX_LENGTH ? `${summary}...` : summary;
}

function generatePostId(): string {
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  assertValidPostId(id);
  return id;
}

function normalizeTags(input: string | string[] | undefined): string[] {
  if (input === undefined || input === null) return [];
  const rawTags = Array.isArray(input) ? input : input.split(",");
  return [
    ...new Set(rawTags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0)),
  ].slice(0, PAGE_LIMITS.postTagMaxCount);
}

function assertCoverImageUrl(coverImage: string | undefined): void {
  if (coverImage === undefined || coverImage === "") return;
  if (!isSafeImageUrl(coverImage)) {
    throw new UnprocessableEntityError(`Invalid cover image URL: ${IMAGE_URL_INVALID_MESSAGE}`);
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  return trimmed;
}

function assertPostOwnedBy(post: Post, currentUserId: string): void {
  if (!post.authorId) {
    throw new ForbiddenError("This post has no author info, cannot perform action");
  }
  if (post.authorId !== currentUserId) {
    throw new ForbiddenError("Not authorized to modify this post");
  }
}

function orderByRecency(posts: Post[], isDraftMode: boolean): Post[] {
  if (isDraftMode) {
    return posts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return posts.sort((a, b) => {
    const isAPinned = a.pinned ? 1 : 0;
    const isBPinned = b.pinned ? 1 : 0;
    if (isAPinned !== isBPinned) return isBPinned - isAPinned;
    const publishedTimeA = a.publishedAt || a.createdAt;
    const publishedTimeB = b.publishedAt || b.createdAt;
    return publishedTimeB.localeCompare(publishedTimeA);
  });
}

export async function listPosts(options: ListPostsOptions): Promise<PostsListData> {
  const isDraftMode = options.isDraft === true;
  const hasViewer = !!options.viewer;

  if (isDraftMode && !hasViewer) {
    return {
      posts: [],
      total: 0,
      page: options.page ?? 1,
      limit: options.limit ?? PAGE_LIMITS.postListDefaultLimit,
      totalPages: 0,
    };
  }

  const limit = Math.min(
    PAGE_LIMITS.postListMaxLimit,
    Math.max(1, options.limit ?? PAGE_LIMITS.postListDefaultLimit),
  );
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * limit;

  const category = options.category?.trim();
  const tag = options.tag?.trim();
  const q = options.q?.trim();

  const filter = {
    isDraft: isDraftMode,
    ...(isDraftMode && options.viewer ? { authorId: options.viewer.id } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    ...(q ? { q } : {}),
  };

  const [posts, total] = await Promise.all([
    listPostsByQuery({
      ...filter,
      orderBy: isDraftMode
        ? { field: "updatedAt", direction: "desc" }
        : { field: "publishedAt", direction: "desc" },
      pinnedFirst: !isDraftMode,
      skip,
      take: limit,
    }),
    countPosts(filter),
  ]);

  return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPost(id: string, viewer?: AuthPayload): Promise<Post> {
  const post = await findPostById(id);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft && viewer?.id !== post.authorId) {
    throw new NotFoundError("Post not found");
  }

  return {
    ...post,
    content: renderPostBody(post.content),
    contentRaw: post.content,
  };
}

export async function createPost(dto: CreatePostDto & { authorId: string }): Promise<Post> {
  const title = requireText(dto.title, "title");
  const content = requireText(dto.content, "content");
  const category = requireText(dto.category, "category");
  assertCoverImageUrl(dto.coverImage);

  const author = await getUserDisplayNameOf(dto.authorId);

  const now = new Date().toISOString();
  const isDraft = Boolean(dto.isDraft);
  const post: Post = {
    id: generatePostId(),
    title,
    summary: dto.summary?.trim() || buildSummary(content),
    content,
    category,
    tags: normalizeTags(dto.tags),
    createdAt: now,
    updatedAt: now,
    isDraft,
    pinned: isDraft ? false : Boolean(dto.pinned),
    coverImage: dto.coverImage?.trim() || undefined,
    authorId: dto.authorId,
    authorName: author,
    views: 0,
    likes: 0,
    favorites: 0,
    commentsCount: 0,
    ...(isDraft ? {} : { publishedAt: now }),
  };

  await runInTransaction(async (tx) => {
    await createPostRecord(post, tx);
    if (!isDraft) {
      await incrementUserStat(dto.authorId, "posts", 1, tx);
    }
  });

  return post;
}

async function getUserDisplayNameOf(userId: string): Promise<string> {
  const author = await getUserById(userId);
  if (!author) throw new NotFoundError("Author not found");
  return getUserDisplayName(author);
}

export async function updatePost(
  id: string,
  dto: UpdatePostDto,
  currentUserId: string,
): Promise<Post> {
  const existing = await findPostById(id);
  if (!existing) throw new NotFoundError("Post not found");
  assertPostOwnedBy(existing, currentUserId);

  const title = dto.title !== undefined ? requireText(dto.title, "title") : existing.title;
  const content =
    dto.content !== undefined ? requireText(dto.content, "content") : existing.content;
  const category =
    dto.category !== undefined ? requireText(dto.category, "category") : existing.category;

  if (dto.coverImage !== undefined) assertCoverImageUrl(dto.coverImage);

  const isDraft = dto.isDraft !== undefined ? Boolean(dto.isDraft) : existing.isDraft;
  const wasDraft = existing.isDraft;

  let summary = existing.summary;
  if (dto.summary !== undefined) {
    summary = dto.summary.trim();
  } else if (dto.content !== undefined) {
    summary = buildSummary(content);
  }

  const now = new Date().toISOString();

  const changes: PostUpdateData = {
    title,
    content,
    category,
    summary,
    tags: dto.tags !== undefined ? normalizeTags(dto.tags) : existing.tags,
    isDraft,
    pinned: isDraft ? false : dto.pinned !== undefined ? Boolean(dto.pinned) : existing.pinned,
    coverImage: dto.coverImage !== undefined ? dto.coverImage.trim() || null : existing.coverImage,
    updatedAt: now,
    ...(wasDraft && !isDraft ? { publishedAt: now } : {}),
    ...(!wasDraft && isDraft ? { publishedAt: null } : {}),
  };

  return runInTransaction(async (tx) => {
    const updated = await updatePostRecord(id, changes, tx);

    const isPublishing = wasDraft && !updated.isDraft;
    const isUnpublishing = !wasDraft && updated.isDraft;
    if ((isPublishing || isUnpublishing) && existing.authorId) {
      await incrementUserStat(existing.authorId, "posts", isPublishing ? 1 : -1, tx);
    }
    return updated;
  });
}

export async function deletePost(id: string, currentUserId: string): Promise<void> {
  const post = await findPostById(id);
  if (!post) throw new NotFoundError("Post not found");
  assertPostOwnedBy(post, currentUserId);

  await runInTransaction(async (tx) => {
    await deletePostRecord(id, tx);
    if (!post.authorId) return;

    if (!post.isDraft) {
      await incrementUserStat(post.authorId, "posts", -1, tx);
    }
    if (post.likes > 0) {
      await incrementUserStat(post.authorId, "likes", -post.likes, tx);
    }
  });
}

export async function recordPostView(id: string): Promise<void> {
  const post = await findPostStatus(id);
  if (!post || post.isDraft) return;

  const postId = post.id;
  const authorId = post.authorId;

  after(async () => {
    try {
      await runInTransaction(async (tx) => {
        await incrementPostCounter(postId, "views", 1, tx);
        if (authorId) {
          await incrementUserStat(authorId, "views", 1, tx);
        }
      });

      logger.info("View recorded", { postId });
    } catch (err) {
      logger.error("Failed to record view count", {
        postId,
        authorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

async function togglePostAssociation(
  postId: string,
  currentUserId: string,
  association: UserPostAssociation,
  counterField: "likes" | "favorites",
): Promise<{ isRemoval: boolean; count: number }> {
  const post = await findPostStatus(postId);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft) throw new ForbiddenError("Cannot perform action on draft post");

  const authorId = post.authorId;
  const shouldTrackAuthorLikes = association === "likedPosts";

  return runInTransaction(async (tx) => {
    const isRemoval = await toggleUserPostAssociation(currentUserId, association, postId, tx);
    const delta = isRemoval ? -1 : 1;

    const count = await incrementPostCounter(postId, counterField, delta, tx);

    if (shouldTrackAuthorLikes && authorId) {
      await incrementUserStat(authorId, "likes", delta, tx);
    }

    return { isRemoval, count };
  });
}

export async function togglePostLike(
  postId: string,
  currentUserId: string,
): Promise<LikeToggleData> {
  const result = await togglePostAssociation(postId, currentUserId, "likedPosts", "likes");
  return { liked: !result.isRemoval, likes: result.count };
}

export async function togglePostFavorite(
  postId: string,
  currentUserId: string,
): Promise<FavoriteToggleData> {
  const result = await togglePostAssociation(postId, currentUserId, "favoritedPosts", "favorites");
  return { favorited: !result.isRemoval, favorites: result.count };
}

export async function listFavoritedPosts(currentUserId: string): Promise<Post[]> {
  const viewer = await getUserWithPostAssociations(currentUserId);
  if (!viewer) throw new NotFoundError("User not found");

  const favoritedPostIds = viewer.favoritedPosts ?? [];
  if (favoritedPostIds.length === 0) return [];

  const posts = await listPostsByQuery({ ids: favoritedPostIds, isDraft: false });
  return orderByRecency(posts, false);
}

export async function listPostsByAuthor(authorId: string): Promise<Post[]> {
  const posts = await listPostsByQuery({ authorId, isDraft: false });
  return orderByRecency(posts, false);
}

export async function getNeighborPosts(id: string): Promise<NeighborPostsData> {
  const post = await findPostById(id);
  if (!post) return { prev: null, next: null };
  return findNeighborPosts(id, post.publishedAt ?? null, post.createdAt);
}

export async function listCategories(): Promise<string[]> {
  return listDistinctCategories();
}

export async function listTags(): Promise<PostTagCount[]> {
  return listTagCounts();
}

export async function assertPostReadable(postId: string, viewerId?: string): Promise<PostStatus> {
  const post = await findPostStatus(postId);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft && post.authorId !== viewerId) {
    throw new NotFoundError("Post not found");
  }
  return post;
}

export async function assertPostCommentable(postId: string): Promise<void> {
  const post = await findPostStatus(postId);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft) throw new ForbiddenError("Cannot comment on draft posts");
}

export { incrementPostCounter };

export async function getRenamedPostId(oldId: string): Promise<string | null> {
  if (isValidPostId(oldId)) return null;
  const newId = await findRenamedPostId(oldId);
  return newId && isValidPostId(newId) ? newId : null;
}
