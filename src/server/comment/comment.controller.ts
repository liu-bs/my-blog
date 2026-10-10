"use server";

import type { Comment, CreateCommentDto } from "@shared";
import { requireAuthPayload } from "@server/auth/auth.guard";
import {
  clientIp,
  ensureNotRateLimited,
  requireId,
  runAction,
  type ActionResult,
} from "@server/common/action-result";
import { RATE_LIMITS } from "@server/common/policy";
import { invalidatePostCache, revalidatePostPath } from "@server/post/post.cache";
import { createComment, deleteComment, updateComment } from "./comment.service";
import { invalidateCommentsCache } from "./comment.cache";
import { parseCreateCommentBody } from "./comment.validator";

export async function createCommentAction(
  postId: string,
  input: CreateCommentDto,
): Promise<ActionResult<Comment>> {
  return runAction("Comment", async () => {
    await ensureNotRateLimited(
      `comments:create:${await clientIp()}`,
      RATE_LIMITS.commentCreateByIp,
    );
    const viewer = await requireAuthPayload();

    const id = requireId(postId, "Post not found");
    const dto = parseCreateCommentBody(input);
    const comment = await createComment({ ...dto, postId: id, userId: viewer.id });

    invalidateCommentsCache(id);
    invalidatePostCache(id);
    revalidatePostPath(id);
    return { ok: true, data: comment };
  });
}

export async function updateCommentAction(
  commentId: string,
  input: CreateCommentDto,
): Promise<ActionResult<Comment>> {
  return runAction("Comment", async () => {
    await ensureNotRateLimited(`comments:update:${await clientIp()}`, RATE_LIMITS.commentEditByIp);
    const viewer = await requireAuthPayload();

    const id = requireId(commentId, "Comment not found");
    const dto = parseCreateCommentBody(input);
    const comment = await updateComment(id, dto.content, viewer.id);

    invalidateCommentsCache(comment.postId);
    invalidatePostCache(comment.postId);
    revalidatePostPath(comment.postId);
    return { ok: true, data: comment };
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction("Comment", async () => {
    await ensureNotRateLimited(
      `comments:delete:${await clientIp()}`,
      RATE_LIMITS.commentDeleteByIp,
    );
    const viewer = await requireAuthPayload();

    const id = requireId(commentId, "Comment not found");
    const deleted = await deleteComment(id, viewer.id);

    invalidateCommentsCache(deleted.postId);
    invalidatePostCache(deleted.postId);
    revalidatePostPath(deleted.postId);
    return { ok: true, data: null };
  });
}
