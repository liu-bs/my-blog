/**
 * @file action.ts
 * @description 定义 Server Actions 的统一返回结构 {@link ActionResult}。
 *              本应用的 UI 变更操作（发布文章、点赞、收藏、评论等）均由 `server/<domain>/<domain>.controller.ts`
 *              返回该结构；客户端通过 `unwrap()`（`@/lib/apiRequest`）拆包：ok 为 true 时取出 data，
 *              为 false 时抛出携带 message/status 的 {@link ApiRequestError}。
 */
import type { ValidationErrorDetail } from "./ui";

/**
 * Server Action 统一返回结果（以 ok 字段判别的联合类型）
 * @description 成功分支：`{ ok: true, data: T }`，data 为业务数据；
 *              失败分支：`{ ok: false, status, message, details? }`，
 *              status 为 HTTP 语义状态码（如 401 未登录、403 无权限、400 参数校验失败），
 *              details 为字段级校验错误列表（{@link ValidationErrorDetail}），仅校验失败时返回。
 * @example
 * // 成功：{ ok: true, data: { liked: true, likes: 5 } }
 * // 失败：{ ok: false, status: 401, message: "请先登录" }
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; details?: ValidationErrorDetail[] };
