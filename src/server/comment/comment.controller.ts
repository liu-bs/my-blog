/**
 * @file comment.controller.ts
 * @description 评论领域的 Server Action 入口，对外暴露「发表 / 编辑 / 删除评论」三个动作。
 * 本层只做 HTTP 侧编排：登录态校验、按 IP 限流、入参解析与文章缓存失效；具体业务规则（可评论性、权限归属、评论数联动）下沉到 comment.service。
 * 使用限制：所有动作都必须登录后调用，未登录统一抛 UnauthorizedError。
 */
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

/**
 * 发表评论
 * @param postId 目标文章 ID，空白字符串按「文章不存在」处理
 * @param input 评论文本，正文的清洗与长度校验由 validator 完成
 * @returns 统一 ActionResult；成功时 data 为新建评论，其中昵称 / 头像取自用户资料的冗余快照
 * @throws UnauthorizedError 未登录
 * @throws RateLimitError 触发评论频控
 * @throws NotFoundError 文章 ID 缺失
 * @description 频率限制按客户端 IP 计，5 分钟内最多 10 次，防止刷评论；写成功后立即失效文章缓存，让评论数尽快对外可见
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

    // 评论数已变化，同步清掉进程内缓存与各语言版本的页面缓存（ISR）
    invalidatePostCache(id);
    revalidatePostPathAllLocales(id);
    return { ok: true, data: comment };
  });
}

/**
 * 编辑评论
 * @param commentId 待编辑的评论 ID，空白字符串按「评论不存在」处理
 * @param input 新评论内容，复用创建评论的校验规则
 * @returns 统一 ActionResult；成功时 data 为更新后的评论
 * @throws UnauthorizedError 未登录
 * @throws ForbiddenError 当前用户不是该评论作者
 * @throws NotFoundError 评论 ID 缺失或评论已被删除
 * @description 限流宽松于发表（60 秒 30 次），避免误伤连续修改；正文变更不影响作者快照，因此无需失效文章缓存
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
 * 删除评论
 * @param commentId 待删除的评论 ID，空白字符串按「评论不存在」处理
 * @returns 统一 ActionResult；删除无返回体，成功时 data 恒为 null
 * @throws UnauthorizedError 未登录
 * @throws ForbiddenError 既不是评论作者也不是所属文章作者
 * @throws NotFoundError 评论 ID 缺失或评论已被删除
 * @description 删除是评论作者与文章作者共有的权限；删除后需回退文章评论数并失效缓存
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
    // 评论记录与其评论数回退在同一事务内完成，这里只负责让缓存跟上
    invalidatePostCache(deleted.postId);
    revalidatePostPathAllLocales(deleted.postId);
    return { ok: true, data: null };
  });
}
