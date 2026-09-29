/**
 * @file route-handler.ts
 * @description Route Handler 的装饰器式封装：defineRoute 把「认证 → 限流 → 解析 params → 调用业务 → 异常兜底」这条固定链路收敛到一处，
 * 业务侧只需关注自己的 handler 与声明式选项，不再重复写 try/catch 与鉴权分支。
 * 使用限制：仅适用于 App Router 的 route.ts；认证依赖 auth.service，限流按客户端 IP 计数。
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
 * 业务 handler 收到的上下文
 * @description 认证与 params 都已由 defineRoute 处理完毕，handler 内拿到的一定是最终值
 */
interface RouteContext<P = Record<string, never>> {
  /** 原始请求对象，用于读取 query / body / headers */
  request: NextRequest;

  /** 从动态路由段解析出的路径参数（Next.js 16 的 params 为 Promise，已在进入 handler 前 await） */
  params: P;

  /** 认证结果：auth 为 "required" 时必非空，"optional"/"none" 时可能为 null */
  auth: AuthPayload | null;
}

/**
 * defineRoute 的声明式选项
 * @description 不传即等价于 auth: "none" 且不限流
 */
interface RouteOptions {
  /** 认证要求：required 强制登录（失败抛 401）、optional 有则带上、none 完全跳过认证；默认 none */
  auth?: "required" | "optional" | "none";

  /** 限流配置，不传则不启用 */
  rateLimit?: {
    /** 限流标识前缀，实际 key 会拼上客户端 IP，避免不同接口之间互相影响 */
    key: string;

    /** 窗口内允许的最大请求次数 */
    limit: number;

    /** 窗口长度，单位毫秒 */
    windowMs: number;

    /** 超限时返回的提示文案，默认 "Too many requests, please try again later" */
    message?: string;
  };
}

/**
 * 包装 Route Handler，统一注入认证、限流与异常处理
 * @param handler 业务处理函数，接收已补全 auth / params 的上下文
 * @param options 可选的认证与限流声明
 * @returns 可直接作为 GET / POST 等导出的处理函数
 * @description 执行顺序固定为：认证 → 限流 → 解析 params → 业务；
 * 任何环节抛错都由 sendError 兜底成统一错误响应，业务 handler 内因此无需再写 try/catch。
 * 认证放行的判定为「先认证后限流」，未登录请求不会占用限流计数。
 */
export function defineRoute<P = Record<string, never>>(
  handler: (ctx: RouteContext<P>) => Promise<NextResponse>,
  options?: RouteOptions,
) {
  return async (request: NextRequest, context?: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      let auth: AuthPayload | null = null;
      if (options?.auth === "required") {
        // 认证所需依赖在此显式注入，便于单测替换
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

      // Next.js 16 起 params 为 Promise，且非动态路由时可能整体为空，这里统一规整成普通对象
      const params = (context?.params ? await context.params : {}) as P;

      return await handler({ request, params, auth });
    } catch (err) {
      return sendError(err);
    }
  };
}

/**
 * 从路径参数中取出必填的 ID
 * @param params 路由参数对象
 * @param label 缺失时错误文案，默认 "Post not found"，用于区分不同资源
 * @returns 去空白后的 ID
 * @throws NotFoundError ID 为空或只有空白字符
 * @description 路由层只做「ID 格式上存在」的判断，资源是否真的存在交给 Service
 */
export function requireId(params: { id?: string }, label = "Post not found"): string {
  const id = params.id?.trim();
  if (!id) throw new NotFoundError(label);
  return id;
}
