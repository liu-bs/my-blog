import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";
import type { Comment } from "@shared";
import type { AtomicStatement } from "@server/common/db";
import { getDb } from "@server/common/db";
import { comments, posts, type CommentRow } from "@server/db/schema";

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

export async function listCommentsByPostId(
  postId: string,
  opts?: { take?: number; skip?: number },
): Promise<Comment[]> {
  const query = getDb()
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt), desc(comments.id));

  const bounded = opts?.take !== undefined ? query.limit(opts.take) : query;
  const rows = await bounded.offset(opts?.skip ?? 0);
  return rows.map(mapToComment);
}

export async function countComments(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(comments)
    .where(eq(comments.postId, postId));
  return row?.n ?? 0;
}

export function insertCommentStmt(comment: Comment): AtomicStatement {
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

export async function updateCommentRecord(
  id: string,
  data: { content: string; updatedAt: string },
): Promise<Comment | null> {
  const [row] = await getDb()
    .update(comments)
    .set({ content: data.content, updatedAt: new Date(data.updatedAt) })
    .where(eq(comments.id, id))
    .returning();
  return row ? mapToComment(row) : null;
}

export async function findCommentById(id: string): Promise<Comment | null> {
  const [row] = await getDb().select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ? mapToComment(row) : null;
}

export async function deleteCommentAndDecrementCounter(
  id: string,
  currentUserId: string,
): Promise<{ postId: string } | null> {
  const { rows } = await getDb().execute<{ post_id: string }>(sql`
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
  `);
  const row = rows[0];
  return row ? { postId: row.post_id } : null;
}

export async function updateCommentsAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<string[]> {
  const { rows } = await getDb().execute<{ post_id: string }>(sql`
    WITH updated AS (
      UPDATE ${comments}
      SET ${sql.raw(comments.userName.name)} = ${userName}, ${sql.raw(comments.userAvatar.name)} = ${userAvatar}
      WHERE ${comments.userId} = ${userId}
      RETURNING ${comments.postId}
    )
    SELECT DISTINCT post_id FROM updated
  `);
  return rows.map((row) => row.post_id);
}
