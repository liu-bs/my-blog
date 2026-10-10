import "server-only";

import type { Comment } from "@shared";
import { getPrisma, isRecordMissingError, type DbClient } from "@server/common/db";

export interface CommentOwnership {
  id: string;

  postId: string;

  userId: string;

  postAuthorId: string | null;
}

type PrismaComment = {
  id: string;

  postId: string;

  userId: string;

  userName: string;

  userAvatar: string | null;

  content: string;

  createdAt: Date;

  updatedAt: Date;
};

function mapToComment(p: PrismaComment): Comment {
  return {
    id: p.id,
    postId: p.postId,
    userId: p.userId,
    userName: p.userName,
    userAvatar: p.userAvatar ?? undefined,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listCommentsByPostId(
  postId: string,
  opts?: { take?: number; skip?: number },
): Promise<Comment[]> {
  const rows = await getPrisma().comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    ...(opts?.take !== undefined && { take: opts.take }),
    ...(opts?.skip !== undefined && { skip: opts.skip }),
  });
  return rows.map(mapToComment);
}

export async function countComments(postId: string): Promise<number> {
  return getPrisma().comment.count({ where: { postId } });
}

export async function createCommentRecord(comment: Comment, tx?: DbClient): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.create({
    data: {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar ?? null,
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
    },
  });
}

export async function deleteCommentRecord(id: string, tx?: DbClient): Promise<void> {
  const client = tx ?? getPrisma();
  await client.comment.delete({ where: { id } });
}

export async function findCommentById(id: string): Promise<Comment | null> {
  const row = await getPrisma().comment.findUnique({ where: { id } });
  return row ? mapToComment(row) : null;
}

export async function findCommentOwnership(id: string): Promise<CommentOwnership | null> {
  const row = await getPrisma().comment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      userId: true,
      post: { select: { authorId: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    postAuthorId: row.post.authorId,
  };
}

export async function updateCommentRecord(
  id: string,
  data: { content: string; updatedAt: string },
): Promise<Comment | null> {
  try {
    const updated = await getPrisma().comment.update({
      where: { id },
      data: { content: data.content, updatedAt: new Date(data.updatedAt) },
    });
    return mapToComment(updated);
  } catch (err: unknown) {
    if (isRecordMissingError(err)) return null;
    throw err;
  }
}

export async function updateCommentsAuthorProfile(
  userId: string,
  userName: string,
  userAvatar: string | null,
): Promise<string[]> {
  const commentedPostIds = await getPrisma().comment.findMany({
    where: { userId },
    select: { postId: true },
    distinct: ["postId"],
  });

  await getPrisma().comment.updateMany({
    where: { userId },
    data: { userName, userAvatar },
  });

  return commentedPostIds.map((row) => row.postId);
}
