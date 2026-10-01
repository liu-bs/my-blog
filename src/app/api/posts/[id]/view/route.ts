/**
 * @file route.ts
 * @description 文章浏览量上报接口：POST /api/posts/[id]/view。
 *              由客户端浏览上报组件在文章进入视口后调用；按「文章+IP」限流 30 次/5 分钟，
 *              命中限流时同样返回成功（不计数），避免前端感知差异
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { isRateLimited, getClientIp } from "@server/common/rate-limit";
import { incrementView } from "@server/blog/blog.service";

/**
 * 上报文章浏览
 * @param request 请求对象，用于提取客户端 IP
 * @param params 路由参数，含文章 id
 * @returns 统一成功响应（无论是否实际计数）
 */
export const POST = defineRoute<{ id: string }>(async ({ request, params }) => {
  const id = requireId(params);

  const ip = getClientIp(request);

  // 按「文章+IP」维度限流 30 次/5 分钟；限流命中时静默返回成功，不重复计数
  if (await isRateLimited(`view:${id}:${ip}`, 30, 5 * 60_000)) {
    return sendSuccess(null, "已记录");
  }

  await incrementView(id);
  return sendSuccess(null, "已记录");
});
