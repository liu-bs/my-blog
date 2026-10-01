/**
 * @file route-handler.ts
 * @description Next.js Route Handler 定义器。统一编排认证（required/optional/none）、IP 限流、
 * 动态路由参数解析与错误兜底，处理器只需关注业务本身；任何抛出的错误经 sendError 转换为标准 JSON 响应。
 */
import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { sendError } from "./api-response";
import { requireAuth, tryAuth, type AuthDeps } from "@server/auth/auth.service";
import type { AuthPayload } from "@shared";
import { isRateLimited, getClientIp } from "@server/common/rate-limit";
import { RateLimitError, NotFoundError } from "@server/common/errors";
import { tokenService } from "@/server/auth/token.service";
import { findUserById } from "@server/user/user.repository";

/**
 * 路由处理上下文
 */
interface RouteContext<P = Record<string, never>> {
  /** 原始请求对象 */
  request: NextRequest;

  /** 动态路由参数（已 await 解包） */
  params: P;

  /** 当前认证载荷，未登录或 auth 为 none 时为 null */
  auth: AuthPayload | null;
}

/**
 * 路由配置项
 */
interface RouteOptions {
  /** 认证模式：required 强制登录、optional 尽力解析、none 跳过认证 */
  auth?: "required" | "optional" | "none";

  /** 基于「限流 key + 客户端 IP」的固定窗口限流配置 */
  rateLimit?: {
    /** 限流 key，实际计数 key 为 `key:ip` */
    key: string;

    /** 窗口内允许的最大次数 */
    limit: number;

    /** 窗口时长，单位毫秒 */
    windowMs: number;

    /** 被限流时返回给客户端的提示文案 */
    message?: string;
  };
}

/**
 * 定义带统一横切逻辑的路由处理器
 * 执行顺序：认证 -> 限流 -> 参数解析 -> 业务 handler；任何异常统一经 sendError 兜底
 * @param handler 业务处理器，接收上下文（request/params/auth）
 * @param options 认证与限流配置
 * @returns 可直接导出给 Next.js 路由的 async handler
 */
export function defineRoute<P = Record<string, never>>(
  handler: (ctx: RouteContext<P>) => Promise<NextResponse>,
  options?: RouteOptions,
) {
  return async (request: NextRequest, context?: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      let auth: AuthPayload | null = null;
      if (options?.auth === "required") {
        const deps: AuthDeps = { tokenService, findUserById };
        auth = await requireAuth(request, deps);
      } else if (options?.auth === "optional") {
        const deps: AuthDeps = { tokenService, findUserById };
        auth = await tryAuth(request, deps);
      }

      if (options?.rateLimit) {
        const ip = getClientIp(request);
        if (
          await isRateLimited(
            `${options.rateLimit.key}:${ip}`,
            options.rateLimit.limit,
            options.rateLimit.windowMs,
          )
        ) {
          throw new RateLimitError(
            options.rateLimit.message ?? "Too many requests, please try again later",
          );
        }
      }

      const params = (context?.params ? await context.params : {}) as P;

      return await handler({ request, params, auth });
    } catch (err) {
      return sendError(err);
    }
  };
}

/**
 * 从路由参数中提取必填的 id
 * @param params 动态路由参数
 * @param label id 缺失时抛出的错误文案
 * @returns 去除首尾空白后的 id
 * @throws id 缺失或为空白时抛出 NotFoundError
 */
export function requireId(params: { id?: string }, label = "Post not found"): string {
  const id = params.id?.trim();
  if (!id) throw new NotFoundError(label);
  return id;
}
