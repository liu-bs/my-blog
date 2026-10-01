/**
 * @file actionResult.ts
 * @description ActionResult 拆箱辅助（客户端用）：把 Server Action 返回的 ActionResult 转为数据或异常；注意与 src/server/common/action-result.ts（服务端 runAction 包装器）是两个不同文件
 */
import { ApiRequestError } from "@/lib/apiRequest";
import type { ActionResult } from "@shared";

/**
 * 拆箱 ActionResult：成功返回 data，失败抛 ApiRequestError
 * @param result Server Action 返回的 ActionResult
 * @returns 成功时的数据
 * @throws 失败时抛出携带 status/message/details 的 ApiRequestError
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ApiRequestError(result.status, result.status, result.message, result.details as never);
}
