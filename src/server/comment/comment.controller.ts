"use server";

import {
  runAction,
  requireAuthPayload,
  ensureNotRateLimited,
  clientIp,
  type ActionResult,
} from "@server/common/action-result";
import { createComment, updateComment, deleteComment } from "@server/comment/comment.service";
import { parseCreateCommentBody } from "@server/comment/comment.validator";
import { invalidatePostCache, revalidatePostPathAllLocales } from "@server/blog/blog.cache";
import { NotFoundError } from "@server/common/errors";
import type { Comment, CreateCommentDto } from "@shared";

export async function createCommentAction(
  postId: string,
  input: CreateCommentDto,
): Promise<ActionResult<Comment>> {
  return runAction("Comment", async ({ authPayload }) => {
    await ensureNotRateLimited(
      `comments:create:${await clientIp()}`,
      10,
      5 * 60_000,
      "Commenting too frequent, please try again later",
    );
    const user = await requireAuthPayload(authPayload);

    const id = postId?.trim();
    if (!id) throw new NotFoundError("Post not found");

    const dto = parseCreateCommentBody(input);
    const comment = await createComment({ ...dto, postId: id, userId: user.id });

    invalidatePostCache(id);
    revalidatePostPathAllLocales(id);
    return { ok: true, data: comment };
  });
}

export async function updateCommentAction(
  commentId: string,
  input: CreateCommentDto,
): Promise<ActionResult<Comment>> {
  return runAction("Comment", async ({ authPayload }) => {
    await ensureNotRateLimited(
      `comments:update:${await clientIp()}`,
      30,
      60_000,
      "Action too frequent, please try again later",
    );
    const user = await requireAuthPayload(authPayload);

    const id = commentId?.trim();
    if (!id) throw new NotFoundError("Comment not found");

    const dto = parseCreateCommentBody(input);
    const comment = await updateComment(id, dto.content, user.id);
    return { ok: true, data: comment };
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction("Comment", async ({ authPayload }) => {
    await ensureNotRateLimited(
      `comments:delete:${await clientIp()}`,
      30,
      60_000,
      "Action too frequent, please try again later",
    );
    const user = await requireAuthPayload(authPayload);

    const id = commentId?.trim();
    if (!id) throw new NotFoundError("Comment not found");

    const deleted = await deleteComment(id, user.id);

    invalidatePostCache(deleted.postId);
    revalidatePostPathAllLocales(deleted.postId);
    return { ok: true, data: null };
  });
}
