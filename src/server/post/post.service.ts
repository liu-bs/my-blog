import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  and,
  arrayContains,
  count,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type {
  AuthPayload,
  CreatePostDto,
  FavoriteToggleData,
  LikeToggleData,
  NeighborPostsData,
  Post,
  PostCounterField,
  PostTagCount,
  PostsListData,
  UpdatePostDto,
  UserPostAssociation,
} from "@shared";
import { IMAGE_URL_INVALID_MESSAGE, assertValidPostId, isSafeImageUrl } from "@shared";
import { stripMarkdown } from "@shared/markdown";
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "@server/common/errors";
import { logger } from "@server/common/logger";
import { POST_LIST_DEFAULT_LIMIT, POST_LIST_MAX_LIMIT, POST_TAG_MAX_COUNT } from "@shared/limits";
import type { AtomicStatement } from "@server/common/db";
import { getDb } from "@server/common/db";
import { posts, userPostFavorites, userPostLikes, users, type PostRow } from "@server/db/schema";
import {
  getUserById,
  getUserDisplayName,
  getUserWithPostAssociations,
  incrementUserStatStmt,
} from "@server/user/user.service";
import { renderPostBody } from "./post.render";

type PostListRow = Omit<PostRow, "content">;

type PostUpdateData = Partial<{
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

interface PostStatus {
  id: string;
  isDraft: boolean;
  authorId: string | null;
}

export interface ListPostsOptions {
  isDraft?: boolean;

  viewer?: AuthPayload;

  category?: string;

  tag?: string;

  q?: string;

  page?: number;

  limit?: number;
}

interface PostQueryOptions {
  isDraft?: boolean;

  authorId?: string;

  category?: string;

  tag?: string;

  q?: string;

  ids?: string[];

  orderBy?: { field: "publishedAt" | "createdAt" | "updatedAt"; direction: "asc" | "desc" };

  pinnedFirst?: boolean;

  skip?: number;

  take?: number;
}

const SUMMARY_MAX_LENGTH = 100;

const MIN_PAGE = 1;

const MAX_PAGE = 1000;

const PREVIEW_MAX_LENGTH = 200_000;

const POST_LIST_COLUMNS = {
  id: posts.id,
  title: posts.title,
  summary: posts.summary,
  category: posts.category,
  tags: posts.tags,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  publishedAt: posts.publishedAt,
  isDraft: posts.isDraft,
  pinned: posts.pinned,
  coverImage: posts.coverImage,
  authorId: posts.authorId,
  authorName: posts.authorName,
  views: posts.views,
  likes: posts.likes,
  favorites: posts.favorites,
  commentsCount: posts.commentsCount,
} as const;

function iso(d: Date): string {
  return d.toISOString();
}

function mapToPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    category: row.category,
    tags: row.tags,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    publishedAt: row.publishedAt ? iso(row.publishedAt) : undefined,
    isDraft: row.isDraft,
    pinned: row.pinned,
    coverImage: row.coverImage ?? undefined,
    authorId: row.authorId ?? undefined,
    authorName: row.authorName ?? undefined,
    views: row.views,
    likes: row.likes,
    favorites: row.favorites,
    commentsCount: row.commentsCount,
  };
}

function mapToListPost(row: PostListRow): Post {
  return mapToPost({ ...row, content: "" });
}

function postFromUpdateResult(result: unknown): Post | null {
  const row = (result as PostRow[] | undefined)?.[0];
  return row ? mapToPost(row) : null;
}

function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function buildWhere(q: PostQueryOptions) {
  const conditions = [];
  if (q.isDraft !== undefined) conditions.push(eq(posts.isDraft, q.isDraft));
  if (q.authorId) conditions.push(eq(posts.authorId, q.authorId));
  if (q.category) conditions.push(eq(posts.category, q.category));
  if (q.tag) conditions.push(arrayContains(posts.tags, [q.tag]));
  if (q.ids && q.ids.length > 0) conditions.push(inArray(posts.id, q.ids));
  if (q.q) {
    const pattern = `%${escapeLike(q.q)}%`;
    conditions.push(
      or(sql`${posts.title} ILIKE ${pattern}`, sql`${posts.content} ILIKE ${pattern}`),
    );
  }
  return and(...conditions);
}

function buildOrderBy(q: PostQueryOptions) {
  const order: SQL[] = [];
  if (q.pinnedFirst) order.push(sql`${posts.pinned} DESC`);

  const sortField = q.orderBy?.field ?? "publishedAt";
  const isDesc = (q.orderBy?.direction ?? "desc") === "desc";

  if (sortField === "publishedAt") {
    order.push(
      isDesc ? sql`${posts.publishedAt} DESC NULLS LAST` : sql`${posts.publishedAt} ASC NULLS LAST`,
    );
  } else if (sortField === "createdAt") {
    order.push(isDesc ? sql`${posts.createdAt} DESC` : sql`${posts.createdAt} ASC`);
  } else {
    order.push(isDesc ? sql`${posts.updatedAt} DESC` : sql`${posts.updatedAt} ASC`);
  }
  return order;
}

function postToUpdateSet(data: PostUpdateData) {
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.summary !== undefined && { summary: data.summary }),
    ...(data.content !== undefined && { content: data.content }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.tags !== undefined && { tags: data.tags }),
    ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
    ...(data.updatedAt !== undefined && { updatedAt: new Date(data.updatedAt) }),
    ...(data.publishedAt !== undefined && {
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    }),
    ...(data.isDraft !== undefined && { isDraft: data.isDraft }),
    ...(data.pinned !== undefined && { pinned: data.pinned }),
    ...(data.coverImage !== undefined && { coverImage: data.coverImage ?? null }),
    ...(data.authorId !== undefined && { authorId: data.authorId ?? null }),
    ...(data.authorName !== undefined && { authorName: data.authorName ?? null }),
    ...(data.views !== undefined && { views: data.views }),
    ...(data.likes !== undefined && { likes: data.likes }),
    ...(data.favorites !== undefined && { favorites: data.favorites }),
    ...(data.commentsCount !== undefined && { commentsCount: data.commentsCount }),
  };
}

function findPostById(id: string): Promise<Post | null> {
  return getDb()
    .select()
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1)
    .then(([row]) => (row ? mapToPost(row) : null));
}

function findPostStatus(id: string): Promise<PostStatus | null> {
  return getDb()
    .select({ id: posts.id, isDraft: posts.isDraft, authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1)
    .then(([row]) => row ?? null);
}

function listPostsByQuery(q: PostQueryOptions): Promise<Post[]> {
  const query = getDb()
    .select(POST_LIST_COLUMNS)
    .from(posts)
    .where(buildWhere(q))
    .orderBy(...buildOrderBy(q));

  const bounded = q.take !== undefined ? query.limit(q.take) : query;
  return bounded.offset(q.skip ?? 0).then((rows) => rows.map(mapToListPost));
}

function countPosts(q: PostQueryOptions): Promise<number> {
  return getDb()
    .select({ n: count() })
    .from(posts)
    .where(buildWhere(q))
    .then(([row]) => row?.n ?? 0);
}

function insertPostStmt(post: Post): AtomicStatement {
  return getDb()
    .insert(posts)
    .values({
      id: post.id,
      title: post.title,
      summary: post.summary,
      content: post.content,
      category: post.category,
      tags: post.tags,
      createdAt: new Date(post.createdAt),
      updatedAt: new Date(post.updatedAt),
      publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
      isDraft: post.isDraft,
      pinned: post.pinned ?? false,
      coverImage: post.coverImage ?? null,
      authorId: post.authorId ?? null,
      authorName: post.authorName ?? null,
      views: post.views ?? 0,
      likes: post.likes ?? 0,
      favorites: post.favorites ?? 0,
      commentsCount: post.commentsCount ?? 0,
    });
}

function updatePostStmt(id: string, data: PostUpdateData): AtomicStatement {
  return getDb().update(posts).set(postToUpdateSet(data)).where(eq(posts.id, id)).returning();
}

function deletePostStmt(id: string): AtomicStatement {
  return getDb().delete(posts).where(eq(posts.id, id));
}

export function incrementPostCounterStmt(
  id: string,
  field: PostCounterField,
  delta: number,
): AtomicStatement {
  const column = posts[field];
  return getDb()
    .update(posts)
    .set({ [field]: sql`${column} + ${delta}` })
    .where(eq(posts.id, id))
    .returning({
      views: posts.views,
      likes: posts.likes,
      favorites: posts.favorites,
      commentsCount: posts.commentsCount,
    });
}

export async function updatePostsAuthorName(userId: string, authorName: string): Promise<string[]> {
  const rows = await getDb()
    .update(posts)
    .set({ authorName })
    .where(eq(posts.authorId, userId))
    .returning({ id: posts.id });
  return rows.map((row) => row.id);
}

function findNeighborPosts(
  postId: string,
  publishedAt: string | null,
  createdAt: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const sortKey = new Date(publishedAt ?? createdAt);
  const created = new Date(createdAt);
  const base = and(eq(posts.isDraft, false), sql`${posts.id} <> ${postId}`);

  return Promise.all([
    getDb()
      .select(POST_LIST_COLUMNS)
      .from(posts)
      .where(
        and(
          base,
          or(
            lt(posts.publishedAt, sortKey),
            and(isNull(posts.publishedAt), lt(posts.createdAt, created)),
          ),
        ),
      )
      .orderBy(sql`${posts.publishedAt} DESC NULLS LAST`, sql`${posts.createdAt} DESC`)
      .limit(1),
    getDb()
      .select(POST_LIST_COLUMNS)
      .from(posts)
      .where(
        and(
          base,
          or(
            gt(posts.publishedAt, sortKey),
            and(isNull(posts.publishedAt), gt(posts.createdAt, created)),
          ),
        ),
      )
      .orderBy(sql`${posts.publishedAt} ASC NULLS LAST`, sql`${posts.createdAt} ASC`)
      .limit(1),
  ]).then(([prevRow, nextRow]) => ({
    prev: prevRow[0] ? mapToListPost(prevRow[0]) : null,
    next: nextRow[0] ? mapToListPost(nextRow[0]) : null,
  }));
}

function togglePostAssociationAndCounters(
  postId: string,
  userId: string,
  association: UserPostAssociation,
): Promise<{ isRemoval: boolean; count: number } | null> {
  const isLike = association === "likedPosts";
  const assocTable = isLike ? userPostLikes : userPostFavorites;
  const counter = isLike ? posts.likes : posts.favorites;
  const authorStat = isLike ? users.statsLikes : null;

  return getDb()
    .execute<{ is_removal: boolean; counter: number }>(
      sql`
    WITH flipped AS (
      DELETE FROM ${assocTable}
      WHERE ${assocTable.userId} = ${userId} AND ${assocTable.postId} = ${postId}
      RETURNING 1
    ), added AS (
      INSERT INTO ${assocTable} (${sql.raw(assocTable.userId.name)}, ${sql.raw(assocTable.postId.name)})
      SELECT ${userId}, ${postId}
      WHERE NOT EXISTS (SELECT 1 FROM flipped)
      ON CONFLICT DO NOTHING
      RETURNING 1
    ), delta AS (
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM flipped) THEN -1
        WHEN EXISTS (SELECT 1 FROM added) THEN 1
        ELSE 0
      END AS d
    )${
      authorStat
        ? sql`, bumped AS (
        UPDATE ${users} SET ${sql.raw(authorStat.name)} = ${authorStat} + delta.d
        FROM delta
        WHERE ${users.id} = (SELECT ${posts.authorId} FROM ${posts} WHERE ${posts.id} = ${postId})
        RETURNING 1
      )`
        : sql``
    }
    UPDATE ${posts}
    SET ${sql.raw(counter.name)} = ${counter} + delta.d
    FROM delta
    WHERE ${posts.id} = ${postId}
    RETURNING (delta.d < 0) AS is_removal, ${counter} AS counter
  `,
    )
    .then(({ rows }) => {
      const row = rows[0];
      if (!row) return null;
      return { isRemoval: row.is_removal, count: row.counter };
    });
}

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
  ].slice(0, POST_TAG_MAX_COUNT);
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

async function getUserDisplayNameOf(userId: string): Promise<string> {
  const author = await getUserById(userId);
  if (!author) throw new NotFoundError("Author not found");
  return getUserDisplayName(author);
}

async function togglePostAssociation(
  postId: string,
  currentUserId: string,
  association: UserPostAssociation,
): Promise<{ isRemoval: boolean; count: number }> {
  const post = await findPostStatus(postId);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft) throw new ForbiddenError("Cannot perform action on draft post");

  const result = await togglePostAssociationAndCounters(postId, currentUserId, association);
  if (!result) throw new NotFoundError("Post not found");
  return result;
}

export async function listPosts(options: ListPostsOptions): Promise<PostsListData> {
  const isDraftMode = options.isDraft === true;
  const hasViewer = !!options.viewer;

  if (isDraftMode && !hasViewer) {
    return {
      posts: [],
      total: 0,
      page: options.page ?? 1,
      limit: options.limit ?? POST_LIST_DEFAULT_LIMIT,
      totalPages: 0,
    };
  }

  const limit = Math.min(
    POST_LIST_MAX_LIMIT,
    Math.max(1, options.limit ?? POST_LIST_DEFAULT_LIMIT),
  );
  const page = Math.max(MIN_PAGE, Math.min(options.page ?? 1, MAX_PAGE));
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

  await getDb().batch([
    insertPostStmt(post),
    ...(isDraft ? [] : [incrementUserStatStmt(dto.authorId, "posts", 1)]),
  ]);

  return post;
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

  const statDelta = wasDraft && !isDraft ? 1 : !wasDraft && isDraft ? -1 : 0;
  const authorId = existing.authorId;

  const [updatedRow] = await getDb().batch([
    updatePostStmt(id, changes),
    ...(statDelta !== 0 && authorId ? [incrementUserStatStmt(authorId, "posts", statDelta)] : []),
  ]);

  const updated = postFromUpdateResult(updatedRow);
  if (!updated) throw new NotFoundError("Post not found");
  return updated;
}

export async function deletePost(id: string, currentUserId: string): Promise<void> {
  const post = await findPostById(id);
  if (!post) throw new NotFoundError("Post not found");
  assertPostOwnedBy(post, currentUserId);

  await getDb().batch([
    deletePostStmt(id),
    ...(post.authorId && !post.isDraft ? [incrementUserStatStmt(post.authorId, "posts", -1)] : []),
    ...(post.authorId && post.likes > 0
      ? [incrementUserStatStmt(post.authorId, "likes", -post.likes)]
      : []),
  ]);
}

export async function recordPostView(id: string): Promise<void> {
  const post = await findPostStatus(id);
  if (!post || post.isDraft) return;

  const postId = post.id;
  const authorId = post.authorId;

  after(async () => {
    try {
      await getDb().batch([
        incrementPostCounterStmt(postId, "views", 1),
        ...(authorId ? [incrementUserStatStmt(authorId, "views", 1)] : []),
      ]);

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

export async function togglePostLike(
  postId: string,
  currentUserId: string,
): Promise<LikeToggleData> {
  const result = await togglePostAssociation(postId, currentUserId, "likedPosts");
  return { liked: !result.isRemoval, likes: result.count };
}

export async function togglePostFavorite(
  postId: string,
  currentUserId: string,
): Promise<FavoriteToggleData> {
  const result = await togglePostAssociation(postId, currentUserId, "favoritedPosts");
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
  const rows = await getDb()
    .selectDistinct({ category: posts.category })
    .from(posts)
    .where(eq(posts.isDraft, false));
  return rows.map((r) => r.category).filter(Boolean);
}

export async function listTags(): Promise<PostTagCount[]> {
  const { rows } = await getDb().execute<{ tag: string; count: number }>(sql`
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT unnest(${posts.tags}) AS tag FROM ${posts} WHERE ${posts.isDraft} = false
    ) t
    GROUP BY tag
    ORDER BY tag
  `);
  return rows.map((r) => ({ name: r.tag, count: r.count }));
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

export function renderPostPreview(content: string): string {
  const markdown = typeof content === "string" ? content.slice(0, PREVIEW_MAX_LENGTH) : "";
  return renderPostBody(markdown);
}
