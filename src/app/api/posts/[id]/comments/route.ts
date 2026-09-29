/**
 * @file api/posts/[id]/comments/route.ts
 * @description 文章评论列表接口，按 offset/limit 分页返回某篇文章的评论；登录态可选，用于补充「是否可删」等视角信息
 */
import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { listComments } from "@server/comment/comment.service";

/**
 * 把查询串里的原始值解析为非负整数
 * @param raw URL 查询参数原始值，可能为 null
 * @returns 合法时返回 >= 0 的整数；缺失或非法（NaN、负数）时返回 undefined，交由 service 走默认分页
 */
function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * 获取文章评论列表（GET /api/posts/[id]/comments）
 * @description 路由参数 id 为文章 ID，查询串支持 limit / offset 分页；未登录也能浏览，登录后额外带上当前用户视角
 * @returns 统一响应体 { code: 0, data: 评论分页数据, message: "获取成功" }
 * @throws NotFoundError 路径未提供 id 时
 */
export const GET = defineRoute<{ id: string }>(
  async ({ auth, params, request }) => {
    /** 缺失 id 直接按 404 处理，避免空参数流入数据层 */
    const postId = requireId(params);
    const search = new URL(request.url).searchParams;

    const data = await listComments({
      postId,
      /** auth 为 null 表示未登录，转成 undefined 让 service 按游客处理 */
      user: auth ?? undefined,
      limit: parsePositiveInt(search.get("limit")),
      offset: parsePositiveInt(search.get("offset")),
    });

    return sendSuccess(data, "获取成功");
  },
  /** auth 策略取 optional：游客可读，登录用户可读到与自身相关的字段 */
  { auth: "optional" },
);
