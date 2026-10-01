"use server";

/**
 * @file comment.controller.ts
 * @description 评论模块 Server Action 控制器（"use server" 边界）。统一经 runAction 包装并
 * 按 IP 限流（创建 10 次/5 分钟，编辑/删除 30 次/分钟），写操作成功后对所属文章做
 * 小范围缓存失效与多语言页面 revalidate。
 */
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

/**
 * 创建评论 Server Action，需登录；IP 限流 10 次/5 分钟
 * 成功后失效该文章缓存并 revalidate 各语言文章页
 * @param postId 文章 id
 * @param input 评论表单数据
 * @returns ActionResult，成功携带新评论
 */
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

/**
 * 编辑评论 Server Action，仅评论作者可改；IP 限流 30 次/分钟
 * @param commentId 评论 id
 * @param input 评论表单数据（复用创建 schema 校验）
 * @returns ActionResult，成功携带更新后的评论
 */
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

/**
 * 删除评论 Server Action，评论作者或文章作者可删；IP 限流 30 次/分钟
 * 成功后按被删评论所属文章失效缓存并 revalidate 各语言文章页
 * @param commentId 评论 id
 * @returns ActionResult，data 恒为 null
 */
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
