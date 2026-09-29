/**
 * @file api-response.ts
 * @description Route Handler 的统一响应构造：成功返回 { code: 0, data, message }，失败由 sendError 把 AppError 转成响应体。
 * 约定 code === 0 表示成功，非 0 时用 HTTP 状态码充当业务码，前端只需判断 code。
 * 使用限制：仅用于 App Router 的 Route Handler（返回 NextResponse）；Server Action 请用 action-result.ts。
 */
import "server-only";
import { NextResponse } from "next/server";
import { isAppError, InternalServerError } from "@server/common/errors";
import { logger } from "@server/common/logger";

/**
 * 构造成功响应
 * @param data 业务数据，随响应体返回
 * @param message 提示文案，默认 "Operation successful"
 * @param status HTTP 状态码，默认 200；创建类接口可传 201
 * @param init 额外响应头，例如 Set-Cookie
 * @returns 统一格式的 NextResponse
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
 * 把任意异常转成统一错误响应
 * @param err 捕获到的异常
 * @returns 统一格式的 NextResponse，code 与 HTTP status 均为错误状态码
 * @description 兜底策略分两层：
 * 1）非 AppError 一律包装成 InternalServerError(500)，避免把未知异常的原始信息泄漏给客户端；
 * 2）状态码 ≥500 时日志记 error（带堆栈）且对外文案脱敏，<500 时只记 warn 并原样返回业务 message 与 details。
 */
export function sendError(err: unknown): NextResponse {
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

  // 5xx 对外只暴露通用文案，防止数据库结构、依赖地址等细节泄漏
  const message =
    appError.statusCode >= 500 ? "Internal server error, please try again later" : appError.message;

  return NextResponse.json(
    {
      code: appError.statusCode,
      data: null,
      message,
      ...(appError.statusCode < 500 && appError.details ? { details: appError.details } : {}),
    },
    { status: appError.statusCode },
  );
}
