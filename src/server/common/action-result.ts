import "server-only";

/**
 * @file Server Action 通用编排工具
 * @description 所有 controller（"use server"）共用的薄封装：统一执行入口 runAction、
 * 错误到 ActionResult 的归一化 toFailure（5xx 隐藏细节只回"Internal server error"，防止内部信息泄露）、
 * 鉴权 payload 获取/强校验、按 key 限流与客户端 IP 提取。
 */

import { headers } from "next/headers";
import type { ValidationErrorDetail, AuthPayload } from "@shared";
import { isAppError, RateLimitError, UnauthorizedError } from "@server/common/errors";
import { logger } from "@server/common/logger";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { getAuthPayload } from "@server/auth/auth.service";

/**
 * 从当前请求头提取客户端 IP（Server Action 场景，供限流 key 使用）
 * @returns 客户端 IP；无法识别时为 "unknown"
 */
export async function clientIp(): Promise<string> {
  return getClientIp({ headers: await headers() });
}

import type { ActionResult } from "@shared";

export type { ActionResult };

/** 5xx 错误对外统一文案（真实原因只进日志，不回传客户端） */
const INTERNAL_ERROR = "Internal server error";

/**
 * 将任意异常归一化为 ActionResult 失败分支
 * @param err 捕获到的未知异常
 * @param label 日志标签（如 Auth/Posts），仅用于错误日志定位
 * @returns { ok:false, status, message, details? }；非 AppError 或 5xx 一律掩码为 500 通用文案
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
 * Server Action 统一执行包装：注入鉴权上下文，捕获所有异常转 ActionResult，错误永不穿透到 UI
 * @param label 日志标签，传给 toFailure
 * @param run 业务函数；ctx.authPayload 为请求级缓存的 payload 获取器
 * @returns 业务返回值或归一化后的失败结果
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
 * 强校验版 payload 获取：未登录直接抛 UnauthorizedError
 * @param authPayload runAction 上下文中的 payload 获取器
 * @returns 已认证的 token payload
 * @throws UnauthorizedError——未登录或 token 失效（401）
 */
export async function requireAuthPayload(
  authPayload: () => Promise<AuthPayload | null>,
): Promise<AuthPayload> {
  const payload = await authPayload();
  if (!payload) throw new UnauthorizedError();
  return payload;
}

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
