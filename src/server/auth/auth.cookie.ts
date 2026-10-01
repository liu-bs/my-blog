/**
 * @file auth.cookie.ts
 * @description 认证 Cookie 读写工具。auth_token 为 httpOnly（防 XSS 窃取 token），
 * auth_status 非 httpOnly（值恒为 "1"，仅供前端跨标签页同步登录态展示，不含敏感信息）；
 * 生产环境强制 secure + sameSite=lax，存活期取 env.COOKIE_MAX_AGE。
 */
import "server-only";

import type { NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import type { User } from "@shared";
import { tokenService } from "./token.service";
import { AUTH_TOKEN_COOKIE, AUTH_STATUS_COOKIE } from "@/lib/authConstants";
import { env } from "@server/common/config/env";

/**
 * 构建两枚认证 Cookie 的公共属性
 * @param overrides 差异项：httpOnly 必给，maxAge 可覆盖（登出时传 0 立即过期）
 */
function cookieOptions(overrides: { httpOnly: boolean; maxAge?: number }) {
  return {
    secure: env.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.COOKIE_MAX_AGE,
    ...overrides,
  };
}

/**
 * 在 Route Handler 响应上签发认证 Cookie
 * 以用户当前 tokenVersion 签发 JWT 写入 auth_token（httpOnly），并置 auth_status=1
 * @param res 待写入的 NextResponse
 * @param user 已登录用户
 */
export function setAuthCookies(res: NextResponse, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  res.cookies.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  res.cookies.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 在 Server Action 中通过 cookies() 写入认证 Cookie
 * Action 场景拿不到 NextResponse，改写入请求 Cookie Jar 由框架回传
 * @param jar Server Action 的 cookies() 句柄
 * @param user 已登录用户
 */
export function setAuthCookiesToJar(jar: ReadonlyRequestCookies, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  jar.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  jar.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 通过 cookies() 句柄清除认证 Cookie（登出场景，maxAge=0 立即过期）
 * 注意：真正的令牌吊销由 bumpTokenVersion 完成，这里仅移除客户端凭据
 * @param jar Server Action 的 cookies() 句柄
 */
export function clearAuthCookiesFromJar(jar: ReadonlyRequestCookies): void {
  jar.set(AUTH_TOKEN_COOKIE, "", cookieOptions({ httpOnly: true, maxAge: 0 }));
  jar.set(AUTH_STATUS_COOKIE, "", cookieOptions({ httpOnly: false, maxAge: 0 }));
}
