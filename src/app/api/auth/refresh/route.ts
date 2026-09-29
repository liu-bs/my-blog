/**
 * @file api/auth/refresh/route.ts
 * @description 登录态续期接口。access_token 过期后若仍处于宽限窗口内，用旧 token 换发新的 httpOnly cookie，实现用户无感续期
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
 * 刷新登录态（POST /api/auth/refresh）
 * @description 从 httpOnly cookie 取 token：未过期直接续期；已过期但落在宽限窗口内允许「过期续签」，超出宽限期才要求重新登录
 * @returns 统一响应体 { code: 0, data: { user }, message }，并通过 Set-Cookie 下发新 token 与登录态标记
 * @throws UnauthorizedError 无 token、token 非法 / 无法解析，或过期时间已超出宽限窗口
 * @warning 先 verify、失败再 decode：是为了区分「签名无效」与「仅仅是过期」，只有后者才允许宽限续期
 */
export const POST = defineRoute(
  async ({ request }) => {
    /** 原始 token 存于 httpOnly cookie，前端 JS 读不到，续期只能由服务端完成 */
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!token) {
      throw new UnauthorizedError("No token, please log in again");
    }
    /** 验签结果；失败时 errorType 用于区分是否只是「expired」 */
    const result = tokenService.verify(token);
    /** 非「过期」的失败（签名不匹配、被篡改等）不具备续期资格 */
    if (!result.success && result.errorType !== "expired") {
      throw new UnauthorizedError("Invalid token, please log in again");
    }
    /** 验签通过用真实 payload；仅过期时降级为不校验签名的 decode，后续由 refresh 内的 tokenVersion 比对兜底 */
    const payload = result.success ? result.payload : tokenService.decode(token);
    if (!payload) {
      throw new UnauthorizedError("Token cannot be parsed, please log in again");
    }

    /** 仅在「过期续签」路径校验宽限窗口，防止旧 token 被无限期续活 */
    if (!result.success && typeof payload.exp === "number") {
      /** 距 token 过期已过去的秒数 */
      const expiredAgo = Math.floor(Date.now() / 1000) - payload.exp;
      /** 超出宽限窗口视为会话彻底失效，必须重新登录 */
      if (expiredAgo > env.JWT_REFRESH_GRACE_SECONDS) {
        throw new UnauthorizedError("Session expired, please log in again");
      }
    }

    /** refresh 会重新校验用户是否存在、tokenVersion 是否匹配、账号是否被禁用，任一不满足即抛错 */
    const user = await refresh(payload);
    const response = NextResponse.json(
      /** toSafeUser 过滤掉 password 等敏感字段后再返回给前端 */
      { code: 0, data: { user: toSafeUser(user) }, message: "Token refreshed" },
      { status: 200 },
    );
    /** 重新签发 token 与登录态 cookie，让后续请求携带新的有效期 */
    setAuthCookies(response, user);
    return response;
  },
  /** 限流：同一 IP 每分钟最多 refresh REFRESH_RATE_LIMIT 次，防止刷新接口被恶意刷取；不启用 auth 策略，鉴权由上方宽限逻辑自行判定 */
  {
    rateLimit: {
      key: "auth:refresh",
      limit: REFRESH_RATE_LIMIT,
      windowMs: 60 * 1000,
      message: "Refresh too frequent, please try again later",
    },
  },
);
