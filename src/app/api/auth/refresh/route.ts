/**
 * @file route.ts
 * @description 认证令牌静默刷新接口：POST /api/auth/refresh。
 *              读取 auth_token cookie 校验 JWT，对「已过期但仍在宽限期内」的令牌
 *              （JWT_REFRESH_GRACE_SECONDS）旋转重签并下发新 cookie，超期或无效则要求重新登录；
 *              按 60 秒窗口限流，防暴力刷接口
 */
import { NextResponse } from "next/server";
import { defineRoute } from "@server/common/http/route-handler";
import { toSafeUser, refresh } from "@server/auth/auth.service";
import { setAuthCookies } from "@server/auth/auth.cookie";
import { UnauthorizedError } from "@server/common/errors";
import { AUTH_TOKEN_COOKIE } from "@/lib/authConstants";
import { env } from "@server/common/config/env";
import { tokenService } from "@server/auth/token.service";
import { REFRESH_RATE_LIMIT } from "@/config/site";

/**
 * 刷新登录态
 * @param request 请求对象，从 cookie 中取当前令牌
 * @returns 刷新成功返回脱敏用户信息并重签认证 cookie；令牌缺失/无效/超宽限期抛 401
 */
export const POST = defineRoute(
  async ({ request }) => {
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!token) {
      throw new UnauthorizedError("No token, please log in again");
    }

    const result = tokenService.verify(token);

    // 仅「签名有效但已过期」允许走刷新流程，其余校验失败直接拒绝
    if (!result.success && result.errorType !== "expired") {
      throw new UnauthorizedError("Invalid token, please log in again");
    }

    // 过期令牌签名校验不通过，退化为仅解码取载荷（签名已在登录时验证过）
    const payload = result.success ? result.payload : tokenService.decode(token);
    if (!payload) {
      throw new UnauthorizedError("Token cannot be parsed, please log in again");
    }

    // 宽限期检查：令牌过期超过 JWT_REFRESH_GRACE_SECONDS 秒后不再允许静默续期
    if (!result.success && typeof payload.exp === "number") {
      const expiredAgo = Math.floor(Date.now() / 1000) - payload.exp;

      if (expiredAgo > env.JWT_REFRESH_GRACE_SECONDS) {
        throw new UnauthorizedError("Session expired, please log in again");
      }
    }

    const user = await refresh(payload);
    const response = NextResponse.json(
      { code: 0, data: { user: toSafeUser(user) }, message: "Token refreshed" },
      { status: 200 },
    );

    setAuthCookies(response, user);
    return response;
  },

  {
    rateLimit: {
      key: "auth:refresh",
      limit: REFRESH_RATE_LIMIT,
      windowMs: 60 * 1000,
      message: "Refresh too frequent, please try again later",
    },
  },
);
