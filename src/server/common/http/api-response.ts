/**
 * @file api-response.ts
 * @description 路由处理器统一响应封装。sendSuccess 输出 {code:0,data,message} 成功结构；
 * sendError 将任意抛出的错误归一化为 AppError 后输出 JSON 错误响应，5xx 对外隐藏内部细节并记 error 日志。
 */
import "server-only";
import { NextResponse } from "next/server";
import { isAppError, InternalServerError } from "@server/common/errors";
import { logger } from "@server/common/logger";

/**
 * 输出成功响应
 * @param data 业务数据
 * @param message 提示信息
 * @param status HTTP 状态码，默认 200
 * @param init 可选的附加响应头
 * @returns 结构为 {code:0,data,message} 的 NextResponse
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
 * 将抛出的错误转换为 JSON 错误响应
 * 非 AppError 一律包装为 500 InternalServerError；
 * 5xx 记 error 日志且对外统一返回模糊文案，避免泄露内部信息；
 * 4xx 记 warn 日志，并透传 message 与字段级 details
 * @param err 处理器抛出的未知错误
 * @returns 状态码与错误码对应的 NextResponse
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
