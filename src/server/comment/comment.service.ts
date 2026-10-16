import "server-only";

import { randomUUID } from "node:crypto";
import { count, desc, eq, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";

import type { Comment, CommentsListData, CreateCommentDto } from "@shared";
import type { AtomicStatement } from "@server/common/db";
import { getDb, isForeignKeyViolation } from "@server/common/db";
import { comments, posts, type CommentRow } from "@server/db/schema";
import {
  assertPostCommentable,
  assertPostReadable,
  incrementPostCounterStmt,
} from "@server/post/post.service";
import { getUserById, getUserDisplayName } from "@server/user/user.service";
import { ForbiddenError, NotFoundError, ValidationError } from "@server/common/errors";
import { COMMENT_LIST_MAX_LIMIT, COMMENT_PAGE_SIZE } from "@shared/limits";

export interface ListCommentsOptions {
  postId: string;

  viewerId?: string;

  limit?: number;

  offset?: number;
}

function mapToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    userName: row.userName,
    userAvatar: row.userAvatar ?? undefined,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sanitizeCommentContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

function listCommentsByPostId(
  postId: string,
  opts?: { take?: number; skip?: number },
): Promise<Comment[]> {
  const query = getDb()
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt), desc(comments.id));

  const bounded = opts?.take !== undefined ? query.limit(opts.take) : query;
  return bounded.offset(opts?.skip ?? 0).then((rows) => rows.map(mapToComment));
}

function countComments(postId: string): Promise<number> {
  return getDb()
    .select({ n: count() })
    .from(comments)
    .where(eq(comments.postId, postId))
    .then(([row]) => row?.n ?? 0);
}

function insertCommentStmt(comment: Comment): AtomicStatement {
  return getDb()
    .insert(comments)
    .values({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar ?? null,
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
    });
}

function findCommentById(id: string): Promise<Comment | null> {
  return getDb()
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1)
    .then(([row]) => (row ? mapToComment(row) : null));
}

function updateCommentRecord(
  id: string,
  data: { content: string; updatedAt: string },
): Promise<Comment | null> {
  return getDb()
    .update(comments)
    .set({ content: data.content, updatedAt: new Date(data.updatedAt) })
    .where(eq(comments.id, id))
    .returning()
    .then(([row]) => (row ? mapToComment(row) : null));
}

function deleteCommentAndDecrementCounter(
  id: string,
  currentUserId: string,
): Promise<{ postId: string } | null> {
  return getDb()
    .execute<{ post_id: string }>(
      sql`
    WITH target AS (
      SELECT ${comments.id} AS id, ${comments.postId} AS post_id
      FROM ${comments}
      JOIN ${posts} ON ${posts.id} = ${comments.postId}
      WHERE ${comments.id} = ${id}
        AND (${comments.userId} = ${currentUserId} OR ${posts.authorId} = ${currentUserId})
    ), deleted AS (
      DELETE FROM ${comments}
      WHERE ${comments.id} IN (SELECT id FROM target)
      RETURNING ${comments.postId} AS post_id
    )
    UPDATE ${posts}
    SET ${sql.raw(posts.commentsCount.name)} = GREATEST(${posts.commentsCount} - 1, 0)
    FROM deleted WHERE ${posts.id} = deleted.post_id
    RETURNING deleted.post_id AS post_id
  `,
    )
    .then(({ rows }) => {
      const row = rows[0];
      return row ? { postId: row.post_id } : null;
    });
}

export async function listComments(options: ListCommentsOptions): Promise<CommentsListData> {
  await assertPostReadable(options.postId, options.viewerId);

  const take = Math.min(COMMENT_LIST_MAX_LIMIT, Math.max(1, options.limit ?? COMMENT_PAGE_SIZE));
  const skip = Math.max(0, options.offset ?? 0);

  const [rows, total] = await Promise.all([
    listCommentsByPostId(options.postId, { take: take + 1, skip }),
    countComments(options.postId),
  ]);

  const hasMore = rows.length > take;
  return { comments: hasMore ? rows.slice(0, take) : rows, total, hasMore };
}

export async function createComment(
  dto: CreateCommentDto & { postId: string; userId: string },
): Promise<Comment> {
  await assertPostCommentable(dto.postId);

  const user = await getUserById(dto.userId);
  if (!user) throw new NotFoundError("User not found");

  const now = new Date().toISOString();
  const comment: Comment = {
    id: randomUUID(),
    postId: dto.postId,
    userId: dto.userId,
    userName: getUserDisplayName(user),
    userAvatar: user.avatar || undefined,
    content: sanitizeCommentContent(dto.content),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await getDb().batch([
      insertCommentStmt(comment),
      incrementPostCounterStmt(dto.postId, "commentsCount", 1),
    ]);
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new NotFoundError("Post not found");
    throw err;
  }

  return comment;
}

export async function updateComment(
  id: string,
  content: string,
  currentUserId: string,
): Promise<Comment> {
  const comment = await findCommentById(id);
  if (!comment) throw new NotFoundError("Comment not found");
  if (comment.userId !== currentUserId) {
    throw new ForbiddenError("Not authorized to edit this comment");
  }

  const trimmed = sanitizeCommentContent(content);
  if (trimmed.length === 0) throw new ValidationError("Comment content cannot be empty");

  const updated = await updateCommentRecord(id, {
    content: trimmed,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new NotFoundError("Comment not found");
  return updated;
}

export async function deleteComment(
  id: string,
  currentUserId: string,
): Promise<{ postId: string }> {
  const deleted = await deleteCommentAndDecrementCounter(id, currentUserId);
  if (!deleted) throw new NotFoundError("Comment not found or not authorized to delete");

  return { postId: deleted.postId };
}

export function updateCommentsAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<string[]> {
  return getDb()
    .execute<{ post_id: string }>(
      sql`
    WITH updated AS (
      UPDATE ${comments}
      SET ${sql.raw(comments.userName.name)} = ${userName}, ${sql.raw(comments.userAvatar.name)} = ${userAvatar}
      WHERE ${comments.userId} = ${userId}
      RETURNING ${comments.postId}
    )
    SELECT DISTINCT post_id FROM updated
  `,
    )
    .then(({ rows }) => rows.map((row) => row.post_id));
}
