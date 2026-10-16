import "server-only";

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
import type { Post, PostCounterField, PostTagCount, UserPostAssociation } from "@shared";
import type { AtomicStatement } from "@server/common/db";
import { getDb } from "@server/common/db";
import { posts, userPostFavorites, userPostLikes, users, type PostRow } from "@server/db/schema";

type PostListRow = Omit<PostRow, "content">;

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

export function postFromUpdateResult(result: unknown): Post | null {
  const row = (result as PostRow[] | undefined)?.[0];
  return row ? mapToPost(row) : null;
}

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

function mapToListPost(row: PostListRow): Post {
  return mapToPost({ ...row, content: "" });
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

export async function findPostById(id: string): Promise<Post | null> {
  const [row] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
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

export async function listPostsByQuery(q: PostQueryOptions): Promise<Post[]> {
  const query = getDb()
    .select(POST_LIST_COLUMNS)
    .from(posts)
    .where(buildWhere(q))
    .orderBy(...buildOrderBy(q));

  const bounded = q.take !== undefined ? query.limit(q.take) : query;
  const rows = await bounded.offset(q.skip ?? 0);
  return rows.map(mapToListPost);
}

export async function countPosts(q: PostQueryOptions): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(posts).where(buildWhere(q));
  return row?.n ?? 0;
}

export async function listDistinctCategories(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ category: posts.category })
    .from(posts)
    .where(eq(posts.isDraft, false));
  return rows.map((r) => r.category).filter(Boolean);
}

export async function listTagCounts(): Promise<PostTagCount[]> {
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

export function insertPostStmt(post: Post): AtomicStatement {
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

export function updatePostStmt(id: string, data: PostUpdateData): AtomicStatement {
  return getDb().update(posts).set(postToUpdateSet(data)).where(eq(posts.id, id)).returning();
}

export function deletePostStmt(id: string): AtomicStatement {
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

export interface PostStatus {
  id: string;

  isDraft: boolean;

  authorId: string | null;
}

export async function findPostStatus(id: string): Promise<PostStatus | null> {
  const [row] = await getDb()
    .select({ id: posts.id, isDraft: posts.isDraft, authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  return row ?? null;
}

export async function findNeighborPosts(
  postId: string,
  publishedAt: string | null,
  createdAt: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const sortKey = new Date(publishedAt ?? createdAt);
  const created = new Date(createdAt);
  const base = and(eq(posts.isDraft, false), sql`${posts.id} <> ${postId}`);

  const [prevRow, nextRow] = await Promise.all([
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
  ]);

  return {
    prev: prevRow[0] ? mapToListPost(prevRow[0]) : null,
    next: nextRow[0] ? mapToListPost(nextRow[0]) : null,
  };
}

export async function togglePostAssociationAndCounters(
  postId: string,
  userId: string,
  association: UserPostAssociation,
): Promise<{ isRemoval: boolean; count: number } | null> {
  const isLike = association === "likedPosts";
  const assocTable = isLike ? userPostLikes : userPostFavorites;
  const counter = isLike ? posts.likes : posts.favorites;
  const authorStat = isLike ? users.statsLikes : null;

  const { rows } = await getDb().execute<{ is_removal: boolean; counter: number }>(sql`
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
  `);

  const row = rows[0];
  if (!row) return null;
  return { isRemoval: row.is_removal, count: row.counter };
}
