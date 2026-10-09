/**
 * @file route-handler.ts
 * @description REST 路由的统一包装器 defineRoute：按「鉴权 → 限流 → 解析动态参数 → 业务 handler」
 * 的顺序执行，并把任何抛出（含 AppError 与未知异常）统一交给 sendError 转成标准响应信封。
 * 业务场景：src/app/api 下的全部 route.ts（refresh、health、文章评论列表、浏览量上报）以及
 * RSS 等对外只读端点。
 * 使用限制：路由文件不要手写鉴权/限流/try-catch，一律经本包装器；Server Action 走 runAction
 * 而非此处。返回值是 Next.js Route Handler 签名的函数，导出为 GET/POST 等具名方法。
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
 * 传给业务 handler 的执行上下文
 */
interface RouteContext<P = Record<string, never>> {
  /** 原始请求对象，用于读取 query、body、headers */
  request: NextRequest;

  /** 已 await 解析好的动态路由参数（如 [id]），无参数路由为空对象 */
  params: P;

  /** 鉴权结果：auth 为 required 时是已校验的载荷，optional 时可能为 null，none 时恒为 null */
  auth: AuthPayload | null;
}

/**
 * defineRoute 的行为开关
 */
interface RouteOptions {
  /**
   * 鉴权模式
   * required-必须登录（缺失/失效抛 401） optional-有则解析无则放行 none-完全跳过鉴权（缺省）
   */
  auth?: "required" | "optional" | "none";

  /** 限流配置，不传则不限流；命中超限抛 RateLimitError（HTTP 429） */
  rateLimit?: {
    /** 限流命名空间，会与解析出的客户端 IP 拼成最终 key */
    key: string;

    /** 窗口内允许的最大请求数，超出即拒绝 */
    limit: number;

    /** 窗口长度，单位毫秒 */
    windowMs: number;

    /** 超限返回给客户端的提示文案，缺省为 "Too many requests, please try again later" */
    message?: string;
  };
}

/**
 * 把一个业务 handler 包装成具备鉴权、限流与统一错误处理的 Route Handler
 * @param handler 业务逻辑，接收 {@link RouteContext}，自行返回 NextResponse
 * @param options 鉴权与限流选项，可为 undefined（此时等价于 auth: "none" 且不限流）
 * @returns 符合 Next.js Route Handler 签名的异步函数，可直接导出为 GET/POST
 * @throws 内部不抛错：handler 抛出的任何错误都被捕获并经 sendError 转成响应，5xx 对外隐藏真实原因
 * @example
 * export const POST = defineRoute(
 *   async ({ request, params, auth }) => {
 *     const body = await request.json();
 *     return sendSuccess(await addView(params.id, body));
 *   },
 *   { auth: "optional", rateLimit: { key: "post-view", limit: 30, windowMs: 5 * 60 * 1000 } },
 * );
 * @warning 执行顺序固定为鉴权 → 限流 → params 解析，限流 key 依赖鉴权无关的客户端 IP，
 * 因此未登录请求同样计入配额；params 为 Promise，只有在此处 await 后 handler 才拿到普通对象
 */
export function defineRoute<P = Record<string, never>>(
  handler: (ctx: RouteContext<P>) => Promise<NextResponse>,
  options?: RouteOptions,
) {
  return async (request: NextRequest, context?: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      let auth: AuthPayload | null = null;
      if (options?.auth === "required") {
        // 注入依赖而非在包装器内直接 import 调用链，便于 auth.service 单独测试
        const deps: AuthDeps = { tokenService, findUserById };
        auth = await requireAuth(request, deps);
      } else if (options?.auth === "optional") {
        const deps: AuthDeps = { tokenService, findUserById };
        auth = await tryAuth(request, deps);
      }

      if (options?.rateLimit) {
        const ip = getClientIp(request);
        // key + IP 组成限流维度，同一接口下不同 IP 各自计数
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
 * 取出并校验动态参数中的资源 id
 * @param params 路由 params，id 可能缺失或为空串
 * @param label 资源不存在时的错误文案，默认 "Post not found"
 * @returns 已 trim 的非空 id
 * @throws NotFoundError（HTTP 404）当 id 缺失、空串或全为空白字符
 * @example
 * const id = requireId(params); // 免去每个路由重复判空
 */
export function requireId(params: { id?: string }, label = "Post not found"): string {
  const id = params.id?.trim();
  if (!id) throw new NotFoundError(label);
  return id;
}
