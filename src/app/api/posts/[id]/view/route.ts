/**
 * @file api/posts/[id]/view/route.ts
 * @description 文章浏览量上报接口，前端进入文章详情时调用一次
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { isRateLimited, getClientIp } from "@server/common/rate-limit";
import { incrementView } from "@server/blog/blog.service";

/**
 * 上报文章浏览（POST /api/posts/[id]/view）
 * @description 按「文章 + 客户端 IP」在 5 分钟内限流 30 次，超限则静默跳过计数，避免刷新刷量
 * @returns 统一响应体 { code: 0, data: null, message: "已记录" }；无论是否真正自增都返回成功，前端无需感知
 * @throws NotFoundError 路径未提供 id 时
 * @warning 限量内不区分登录用户与游客；采用「超限也返回成功」是为了让上报接口对调用方保持幂等语义
 */
export const POST = defineRoute<{ id: string }>(async ({ request, params }) => {
  const id = requireId(params);

  /** 真实客户端 IP，用作限流维度；缺少代理头时回退为 "unknown" */
  const ip = getClientIp(request);

  /** 5 分钟内同一 IP 对同一篇文章最多计 30 次浏览量，超过则直接返回不再自增 */
  if (await isRateLimited(`view:${id}:${ip}`, 30, 5 * 60_000)) {
    return sendSuccess(null, "已记录");
  }

  await incrementView(id);
  return sendSuccess(null, "已记录");
});
