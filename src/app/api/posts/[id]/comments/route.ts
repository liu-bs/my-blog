/**
 * @file route.ts (GET /api/posts/[id]/comments)
 * @description 文章评论列表 REST 路由：供外部消费者或客户端分页加载评论，
 * 逻辑复用 server/comment 服务层（与 Server Action 同入口，不重复实现业务）。
 * 鉴权：optional——登录用户可见更多状态字段，未登录仅返回公开数据。
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { listComments } from "@server/comment/comment.service";
import { parseNonNegativeInt } from "@shared";

/**
 * GET /api/posts/[id]/comments
 * 路径参数：id - 文章 ID（requireId 校验，非法时报错）。
 * 查询参数：limit - 每页条数（非负整数，非法值走服务层默认）；offset - 偏移量（同上）。
 * 响应结构：{ code: 0, data: 评论分页数据, message: "获取成功" }，200。
 * 鉴权：auth: "optional"，登录态通过 tryAuth 注入 auth，未登录为 null 不拦截。
 */
export const GET = defineRoute<{ id: string }>(
  async ({ auth, params, request }) => {
    const postId = requireId(params);
    const search = new URL(request.url).searchParams;

    const data = await listComments({
      postId,

      // 登录态可选传入，服务层据此决定评论的可见性与操作标记
      user: auth ?? undefined,
      limit: parseNonNegativeInt(search.get("limit")),
      offset: parseNonNegativeInt(search.get("offset")),
    });

    return sendSuccess(data, "获取成功");
  },

  { auth: "optional" },
);
