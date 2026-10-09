"use server";

/**
 * @file 评论域 Server Action 控制器
 * @description 评论创建/编辑/删除的服务端入口。薄编排层：限流 → 鉴权 → 校验 → comment.service 业务
 * → 失效所在文章的缓存（invalidatePostCache + revalidatePostPath），保证评论数与列表即时一致。
 * 评论域无独立 cache.ts，缓存失效借用 blog.cache 的文章级 tag 工具。
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
import { invalidatePostCache, revalidatePostPath } from "@server/blog/blog.cache";
import { NotFoundError } from "@server/common/errors";
import type { Comment, CreateCommentDto } from "@shared";

/**
 * 发表评论 Action
 * @description 按 IP 限流 10 次/5 分钟；postId 取参数并 trim，用户身份取自 token 不信任前端
 * 调用方 UI：src/hooks/useComments.ts（评论区组件）
 * @param postId 目标文章 ID
 * @param input 评论内容 DTO
 * @returns 新建的评论记录
 * @throws 限流（429）、未登录（401）、文章不存在（404）、草稿不可评论（403）、内容校验失败（400）
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
    revalidatePostPath(id);
    return { ok: true, data: comment };
  });
}

/**
 * 编辑评论 Action（仅评论作者可改，所有权校验在 service 内）
 * @description 按 IP 限流 30 次/分钟；复用创建校验器，内容规则与发表一致
 * 调用方 UI：src/hooks/useComments.ts
 * @param commentId 评论 ID
 * @param input 新的评论内容 DTO
 * @returns 更新后的评论记录
 * @throws 限流（429）、未登录（401）、评论不存在（404）、非本人评论（403）、内容为空（400）
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

    invalidatePostCache(comment.postId);
    revalidatePostPath(comment.postId);
    return { ok: true, data: comment };
  });
}

/**
 * 删除评论 Action（评论作者或文章作者可删，规则在 service 内）
 * @description 按 IP 限流 30 次/分钟；删除成功后按返回的 postId 失效文章缓存
 * 调用方 UI：src/hooks/useComments.ts
 * @param commentId 评论 ID
 * @returns 成功时 data 为 null
 * @throws 限流（429）、未登录（401）、评论不存在（404）、无删除权限（403）
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
    revalidatePostPath(deleted.postId);
    return { ok: true, data: null };
  });
}
