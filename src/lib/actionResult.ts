/**
 * @file actionResult.ts
 * @description Server Action 结果解包工具：把 `ActionResult<T>` 统一的成功/失败返回值，转成「成功返回数据、失败抛 ApiRequestError」的常规风格
 */
import { ApiRequestError } from "@/lib/apiRequest";
import type { ActionResult } from "@shared";

/**
 * 解包 Server Action 的返回值
 * @description Server Action 以及返回值而非 reject 的方式表达失败，便于直接按 `if (!res.ok)` 分支；
 * 而 useAsyncAction、表单错误映射等下游逻辑习惯「抛异常 + 按 status/details 分类」，故集中在此转换
 * @param result Server Action 返回的判别联合结果
 * @returns 成功分支的业务数据
 * @throws {ApiRequestError} 失败分支抛出；status 同时作为 HTTP 状态码与业务 code 传入（ActionResult 未单独携带业务 code）
 * @example
 * const post = unwrap(await createPostAction(dto));
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ApiRequestError(result.status, result.status, result.message, result.details as never);
}
