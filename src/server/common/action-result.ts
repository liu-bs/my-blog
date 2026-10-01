/**
 * @file action-result.ts
 * @description Server Action 统一执行包装器。runAction 捕获业务抛错并经 toFailure 归一化为
 * ActionResult（{ok:false,status,message,details}），配套 requireAuthPayload 强制登录、
 * ensureNotRateLimited 限流前置检查；5xx 错误对外隐藏内部细节并记 error 日志。
 */
import "server-only";
import { headers } from "next/headers";
import type { ValidationErrorDetail, AuthPayload } from "@shared";
import { isAppError, RateLimitError, UnauthorizedError } from "@server/common/errors";
import { logger } from "@server/common/logger";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { getAuthPayload } from "@server/auth/auth.service";

/**
 * 获取当前请求的客户端 IP（Server Action 场景，从 next/headers 读取）
 * @returns 客户端 IP，无法识别时为 "unknown"
 */
export async function clientIp(): Promise<string> {
  return getClientIp({ headers: await headers() });
}

import type { ActionResult } from "@shared";

export type { ActionResult };

/** 5xx 场景对外统一返回的模糊错误文案，避免泄露内部信息 */
const INTERNAL_ERROR = "Internal server error";

/**
 * 将任意抛出的错误转换为失败态 ActionResult
 * 非 AppError 或 5xx 均记录日志并对外返回统一 500 文案；
 * 4xx 透传真实 message 与字段级 details 给前端展示
 * @param err Action 内抛出的未知错误
 * @param label Action 标识，用于未知错误的日志定位
 * @returns 失败态 ActionResult
 */
export function toFailure(
  err: unknown,
  label = "Server Action",
): Extract<ActionResult<never>, { ok: false }> {
  if (!isAppError(err)) {
    logger.error(err instanceof Error ? err.message : `${label} unknown error`, {
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, status: 500, message: INTERNAL_ERROR };
  }
  if (err.statusCode >= 500) {
    logger.error(err.message, { code: err.code, statusCode: err.statusCode });
    return { ok: false, status: err.statusCode, message: INTERNAL_ERROR };
  }
  return {
    ok: false,
    status: err.statusCode,
    message: err.message,
    details: err.details as ValidationErrorDetail[] | undefined,
  };
}

/**
 * Server Action 统一执行入口
 * 包装业务函数并兜底捕获异常：任何抛错都经 toFailure 归一化为失败态 ActionResult，
 * 保证 Action 永不向客户端抛出未处理异常；ctx.authPayload 可按需解析当前登录态
 * @param label Action 标识，用于错误日志定位
 * @param run 业务逻辑，返回成功或失败态 ActionResult
 * @returns 成功或失败态 ActionResult
 */
export async function runAction<T>(
  label: string,
  run: (ctx: { authPayload: () => Promise<AuthPayload | null> }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run({ authPayload: getAuthPayload });
  } catch (err) {
    return toFailure(err, label);
  }
}

/**
 * 要求当前请求必须已登录
 * @param authPayload 登录态解析函数（通常来自 runAction 注入的 ctx.authPayload）
 * @returns 认证载荷（仅含用户 id 与 tokenVersion）
 * @throws 未登录时抛出 UnauthorizedError（401）
 */
export async function requireAuthPayload(
  authPayload: () => Promise<AuthPayload | null>,
): Promise<AuthPayload> {
  const payload = await authPayload();
  if (!payload) throw new UnauthorizedError();
  return payload;
}

/**
 * 限流前置检查，超出阈值即抛错终止 Action
 * @param key 限流标识（内部会拼上客户端 IP 等维度）
 * @param limit 窗口内允许的最大次数
 * @param windowMs 固定窗口时长，单位毫秒
 * @param message 命中限流时抛出的提示文案
 * @throws 超出限流阈值时抛出 RateLimitError（429）
 */
export async function ensureNotRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): Promise<void> {
  if (await isRateLimited(key, limit, windowMs)) {
    throw new RateLimitError(message);
  }
}
