/**
 * @file api-response.ts
 * @description REST 路由统一响应封装：sendSuccess 产出 { code: 0, data, message } 成功信封，
 * sendError 将任意错误（AppError 或未知异常）映射为 { code: statusCode, data: null, message } 失败信封
 * 并按状态码分级记录日志。
 * 客户端 @/lib/apiRequest 以 code === 0 且 HTTP 2xx 作为唯一成功判定，所有 REST 路由（src/app/api 下
 * 经 defineRoute 包装的 route.ts）必须通过这两个函数出响应。仅限服务端（顶部 server-only 守卫）。
 */
import "server-only";
import { NextResponse } from "next/server";
import { isAppError, InternalServerError } from "@server/common/errors";
import { logger } from "@server/common/logger";

/**
 * 返回成功响应
 * @param data 业务数据载荷，客户端成功时取到的即此字段；无返回数据时可传 null
 * @param message 提示信息，默认 "Operation successful"
 * @param status HTTP 状态码，默认 200（如创建类接口可用 201）
 * @param init 可选初始化项；init.headers 为附加响应头（如缓存、CORS）
 * @returns 携带 { code: 0, data, message } JSON 的 NextResponse
 * @example
 * return sendSuccess({ list }, "获取成功");
 */
export function sendSuccess<T>(
  data: T,
  message = "Operation successful",
  status = 200,
  init?: { headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json({ code: 0, data, message }, { status, headers: init?.headers });
}

/**
 * 返回失败响应
 * @description 错误到响应的映射规则：
 * - AppError（4xx）：HTTP 状态码与 code 取其 statusCode，message 原样返回，details 透传给客户端；
 * - AppError（5xx）或任意非 AppError 异常：兜底为 500，对外统一返回 "Internal server error, please try again later"，
 *   真实错误信息只写日志，防止内部细节泄漏；
 * - 日志分级：statusCode >= 500 走 logger.error（含 stack），其余走 logger.warn。
 * @param err 捕获到的任意错误值
 * @returns 携带失败信封 { code, data: null, message, details? } 且 HTTP 状态码匹配错误语义的 NextResponse
 * @example
 * // defineRoute 的 catch 分支即调用：
 * return sendError(err);
 * @warning 本函数不会抛错，但调用后必须把返回值作为路由响应返回，否则请求将无响应体
 */
export function sendError(err: unknown): NextResponse {
  // 非 AppError 的未知异常统一包装为 500，保留原始 message 仅供日志使用
  const appError = isAppError(err)
    ? err
    : new InternalServerError(err instanceof Error ? err.message : "Internal server error");

  if (appError.statusCode >= 500) {
    logger.error(appError.message, {
      code: appError.code,
      statusCode: appError.statusCode,
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    logger.warn(appError.message, { code: appError.code, statusCode: appError.statusCode });
  }

  // 5xx 对外屏蔽真实原因，只给通用兜底文案
  const message =
    appError.statusCode >= 500 ? "Internal server error, please try again later" : appError.message;

  return NextResponse.json(
    {
      code: appError.statusCode,
      data: null,
      message,
      // 校验明细仅对 4xx 客户端可见，5xx 不外露
      ...(appError.statusCode < 500 && appError.details ? { details: appError.details } : {}),
    },
    { status: appError.statusCode },
  );
}
