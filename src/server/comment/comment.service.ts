import "server-only";

import { randomUUID } from "node:crypto";

import sanitizeHtml from "sanitize-html";

import type { Comment, CommentsListData, CreateCommentDto } from "@shared";
import {
  assertPostCommentable,
  assertPostReadable,
  incrementPostCounter,
} from "@server/post/post.service";
import { getUserById, getUserDisplayName } from "@server/user/user.service";
import { isForeignKeyViolation, isRecordMissingError, runInTransaction } from "@server/common/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@server/common/errors";
import { PAGE_LIMITS } from "@server/common/policy";
import {
  countComments,
  createCommentRecord,
  deleteCommentRecord,
  findCommentById,
  findCommentOwnership,
  listCommentsByPostId,
  updateCommentRecord,
} from "./comment.repository";

export { updateCommentsAuthorProfile } from "./comment.repository";

export interface ListCommentsOptions {
  postId: string;

  viewerId?: string;

  limit?: number;

  offset?: number;
}

function sanitizeCommentContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

export async function listComments(options: ListCommentsOptions): Promise<CommentsListData> {
  await assertPostReadable(options.postId, options.viewerId);

  const take = Math.min(
    PAGE_LIMITS.commentListMaxLimit,
    Math.max(1, options.limit ?? PAGE_LIMITS.commentListDefaultLimit),
  );
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
    await runInTransaction(async (tx) => {
      await createCommentRecord(comment, tx);
      await incrementPostCounter(dto.postId, "commentsCount", 1, tx);
    });
  } catch (err) {
    if (isRecordMissingError(err) || isForeignKeyViolation(err)) {
      throw new NotFoundError("Post not found");
    }
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
  const ownership = await findCommentOwnership(id);
  if (!ownership) throw new NotFoundError("Comment not found");

  const isCommentAuthor = ownership.userId === currentUserId;
  const isPostAuthor = ownership.postAuthorId === currentUserId;
  if (!isCommentAuthor && !isPostAuthor) {
    throw new ForbiddenError("Not authorized to delete this comment");
  }

  try {
    await runInTransaction(async (tx) => {
      await deleteCommentRecord(id, tx);
      await incrementPostCounter(ownership.postId, "commentsCount", -1, tx);
    });
  } catch (err) {
    if (isRecordMissingError(err)) return { postId: ownership.postId };
    throw err;
  }

  return { postId: ownership.postId };
}
