/**
 * @file route.ts (POST /api/posts/[id]/view)
 * @description 文章浏览量上报路由：详情页客户端（ViewReporter）访问后调用，为浏览量计数 +1。
 * 鉴权：无（游客也计数）。限流：内置 IP+文章维度去重，非错误性限流——超限静默返回成功，不报错。
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { isRateLimited, getClientIp } from "@server/common/rate-limit";
import { incrementView } from "@server/blog/blog.service";

/**
 * POST /api/posts/[id]/view
 * 路径参数：id - 文章 ID（requireId 校验）。
 * 响应结构：{ code: 0, data: null, message: "已记录" }，200；无论是否命中限流均返回相同响应，
 * 避免向调用方暴露计数策略。
 * 限流：同一 IP 对同一文章 5 分钟内最多计 30 次，超出仅静默跳过 incrementView。
 */
export const POST = defineRoute<{ id: string }>(async ({ request, params }) => {
  const id = requireId(params);

  const ip = getClientIp(request);

  // 防刷：超出窗口配额时不计数，但仍返回"已记录"保持响应一致
  if (await isRateLimited(`view:${id}:${ip}`, 30, 5 * 60_000)) {
    return sendSuccess(null, "已记录");
  }

  await incrementView(id);
  return sendSuccess(null, "已记录");
});
