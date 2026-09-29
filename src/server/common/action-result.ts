/**
 * @file action-result.ts
 * @description Server Action 的公共运行时封装：把「抛异常」的 Service 层适配成「返回 ActionResult」的 Action 层，
 * 并提供登录态断言与限流断言两个前置检查。
 * 与 route-handler 的差别：Server Action 不能自定义 HTTP 状态码，错误只能以 { ok: false, status, message } 的形式回传前端。
 * 使用限制：依赖 next/headers（读取 cookie），只能在 Server Action / RSC 中调用；不可用于 Route Handler。
 */
import "server-only";
import { headers } from "next/headers";
import type { ValidationErrorDetail, AuthPayload } from "@shared";
import { isAppError, RateLimitError, UnauthorizedError } from "@server/common/errors";
import { logger } from "@server/common/logger";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { getAuthPayload } from "@server/auth/auth.service";

/**
 * 读取当前请求的客户端 IP
 * @returns 客户端 IP，无法识别时返回 "unknown"
 * @description 基于 next/headers 拿到本次 Server Action 的请求头，再复用限流模块的头部降级策略
 */
export async function clientIp(): Promise<string> {
  return getClientIp({ headers: await headers() });
}

import type { ActionResult } from "@shared";

export type { ActionResult };

/** 兜底错误文案：任何非 AppError 或 5xx 错误对外都只暴露这一句，避免泄漏内部实现细节 */
const INTERNAL_ERROR = "Internal server error";

/**
 * 把任意异常转换为失败的 ActionResult
 * @param err 捕获到的异常
 * @param label 日志中标识来源的标签，默认 "Server Action"，便于按领域检索
 * @returns 失败态 ActionResult；status 为 HTTP 语义状态码，message 为可展示文案
 * @description 非 AppError（程序 bug、数据库异常等）统一记 error 日志并降级为 500 + 通用文案；
 * AppError 中 ≥500 的同样对外脱敏但保留日志，<500 的（校验 / 权限 / 未登录）才把真实 message 与 details 交给前端
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
 * Server Action 的统一执行壳
 * @param label 异常日志标签，通常传领域名（如 "Comment"）
 * @param run 业务回调，通过参数拿到懒加载的 authPayload 读取器
 * @returns 业务回调的 ActionResult，异常时兜底为失败态
 * @description authPayload 以函数形式注入而非直接取值，让不需要登录态的 Action 也能省掉一次解析开销
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
 * 断言当前请求已登录
 * @param authPayload 来自 runAction 上下文的登录态读取器
 * @returns 登录凭证 payload（含 userId 等信息）
 * @throws UnauthorizedError 未登录或令牌失效
 */
export async function requireAuthPayload(
  authPayload: () => Promise<AuthPayload | null>,
): Promise<AuthPayload> {
  const payload = await authPayload();
  if (!payload) throw new UnauthorizedError();
  return payload;
}

/**
 * 断言当前请求未触发限流
 * @param key 限流标识，调用方需自行拼接用户维度或 IP 维度
 * @param limit 窗口内允许的最大次数
 * @param windowMs 窗口长度，单位毫秒
 * @param message 触发限流时返回给前端的提示文案
 * @throws RateLimitError 已超限
 * @description 限流本身对数据库异常是「放行」语义（见 rate-limit.ts），因此这里只在明确超限时抛错
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
