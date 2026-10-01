/**
 * @file route.ts
 * @description 文章评论列表接口：GET /api/posts/[id]/comments。
 *              由客户端评论 island 在滚动进入视口（IntersectionObserver）时懒加载调用，
 *              支持 limit/offset 分页；auth 为 optional，登录后可拿到点赞等个人态
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { listComments } from "@server/comment/comment.service";

/**
 * 解析非负整数查询参数
 * @param raw 原始查询参数值
 * @returns 合法的非负整数；缺失或非法时返回 undefined（走服务端默认值）
 */
function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * 获取文章评论列表
 * @param auth 可选登录态（optional），用于附带当前用户的点赞等个人态
 * @param params 路由参数，含文章 id
 * @param request 请求对象，用于读取 limit/offset 分页参数
 * @returns 评论分页数据（含登录用户的互动状态）
 */
export const GET = defineRoute<{ id: string }>(
  async ({ auth, params, request }) => {
    const postId = requireId(params);
    const search = new URL(request.url).searchParams;

    const data = await listComments({
      postId,

      user: auth ?? undefined,
      limit: parsePositiveInt(search.get("limit")),
      offset: parsePositiveInt(search.get("offset")),
    });

    return sendSuccess(data, "获取成功");
  },

  { auth: "optional" },
);
