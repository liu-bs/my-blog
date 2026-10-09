/**
 * @file route.ts (POST /api/auth/refresh)
 * @description Token 刷新路由：校验请求 Cookie 中的 JWT，在过期宽限期内允许换取新 token，
 * 并通过 setAuthCookies 重写认证 Cookie。属于外部可用的 REST 入口（供前端拦截器/第三方调用）。
 * 鉴权：无需登录态，但必须携带可解析的认证 Cookie；限流：每 IP 每分钟 REFRESH_RATE_LIMIT 次。
 */
import { NextResponse } from "next/server";
import { defineRoute } from "@server/common/http/route-handler";
import { toSafeUser, refresh } from "@server/auth/auth.service";
import { setAuthCookies } from "@server/auth/auth.cookie";
import { UnauthorizedError } from "@server/common/errors";
import { AUTH_TOKEN_COOKIE } from "@shared";
import { env } from "@server/common/config/env";
import { tokenService } from "@server/auth/token.service";
import { REFRESH_RATE_LIMIT } from "@/config/site";

/**
 * POST /api/auth/refresh
 * 请求参数：无 body，依赖 Cookie 中的 AUTH_TOKEN_COOKIE。
 * 响应结构：{ code: 0, data: { user: SafeUser }, message: "Token refreshed" }，200。
 * 流程：
 * 1. 无 token → 401；
 * 2. token 校验失败且非"过期"类错误（签名无效等）→ 401；
 * 3. 已过期 token 仅在宽限期 JWT_REFRESH_GRACE_SECONDS 内可刷新（覆盖网络延迟边界），超期 → 401；
 * 4. 校验通过后调用 refresh 签发新 token 并写入认证 Cookie。
 */
export const POST = defineRoute(
  async ({ request }) => {
    // 1. 从 Cookie 取认证 token，缺失则要求重新登录
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!token) {
      throw new UnauthorizedError("No token, please log in again");
    }

    // 2. 校验签名与有效期；过期之外的失败（如签名无效）直接拒绝
    const result = tokenService.verify(token);

    if (!result.success && result.errorType !== "expired") {
      throw new UnauthorizedError("Invalid token, please log in again");
    }

    // 3. 取 payload：校验通过用解析结果；已过期则解码（不校验）以便判断宽限期
    const payload = result.success ? result.payload : tokenService.decode(token);
    if (!payload) {
      throw new UnauthorizedError("Token cannot be parsed, please log in again");
    }

    // 4. 过期 token 仅在宽限期内可刷新，超出则视为会话彻底失效
    if (!result.success && typeof payload.exp === "number") {
      const expiredAgo = Math.floor(Date.now() / 1000) - payload.exp;

      if (expiredAgo > env.JWT_REFRESH_GRACE_SECONDS) {
        throw new UnauthorizedError("Session expired, please log in again");
      }
    }

    // 5. 刷新签发新 token，返回脱敏用户信息并重写认证 Cookie
    const user = await refresh(payload);
    const response = NextResponse.json(
      { code: 0, data: { user: toSafeUser(user) }, message: "Token refreshed" },
      { status: 200 },
    );

    setAuthCookies(response, user);
    return response;
  },

  {
    // 限流：按 IP 维度，每分钟最多 REFRESH_RATE_LIMIT 次，防止 token 刷新接口被刷
    rateLimit: {
      key: "auth:refresh",
      limit: REFRESH_RATE_LIMIT,
      windowMs: 60 * 1000,
      message: "Refresh too frequent, please try again later",
    },
  },
);
