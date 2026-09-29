/**
 * @file auth.cookie.ts
 * @description 认证 cookie 的写入与清理封装。JWT 存放在 httpOnly 的 auth_token（脚本不可读，防 XSS 窃取），
 * 另写一个非 httpOnly 的 auth_status 供前端和服务端组件快速判断登录态
 */
import "server-only";

import type { NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import type { User } from "@shared";
import { tokenService } from "./token.service";
import { AUTH_TOKEN_COOKIE, AUTH_STATUS_COOKIE } from "@/lib/authConstants";
import { env } from "@server/common/config/env";

/**
 * 构造认证 cookie 的通用属性
 * @description secure 仅生产环境开启（本地 http 调试需关闭）；sameSite=lax 兼顾 CSRF 防护与顶级跳转场景；
 * maxAge 默认取 COOKIE_MAX_AGE，传 0 表示立即过期即删除（登出时用）
 * @param overrides httpOnly 必须显式指定；maxAge 可选覆盖默认值
 * @returns 可直接传给 cookies.set 的属性对象
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
 * 向响应写入认证 cookie（用于 Route Handler / 中间件拿到 NextResponse 的场景）
 * @param res 待写入 cookie 的响应对象
 * @param user 已通过认证的用户，tokenVersion 决定令牌是否随登出失效
 * @returns 无返回值，副作用为向响应追加 auth_token 与 auth_status 两个 cookie
 */
export function setAuthCookies(res: NextResponse, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  res.cookies.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  res.cookies.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 从响应清除认证 cookie
 * @param res 待清理 cookie 的响应对象
 * @returns 无返回值，通过 maxAge=0 覆盖写入空值实现删除
 */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(AUTH_TOKEN_COOKIE, "", cookieOptions({ httpOnly: true, maxAge: 0 }));
  res.cookies.set(AUTH_STATUS_COOKIE, "", cookieOptions({ httpOnly: false, maxAge: 0 }));
}

/**
 * 向 Server Action 的 cookie jar 写入认证 cookie（用于 action 中 await cookies() 得到的可写 jar）
 * @param jar 来自 next/headers 的可写请求 cookie 容器
 * @param user 已通过认证的用户
 * @returns 无返回值，副作用为写入 auth_token 与 auth_status
 */
export function setAuthCookiesToJar(jar: ReadonlyRequestCookies, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  jar.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  jar.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 从 Server Action 的 cookie jar 清除认证 cookie
 * @param jar 来自 next/headers 的可写请求 cookie 容器
 * @returns 无返回值，通过 maxAge=0 覆盖写入空值实现删除
 */
export function clearAuthCookiesFromJar(jar: ReadonlyRequestCookies): void {
  jar.set(AUTH_TOKEN_COOKIE, "", cookieOptions({ httpOnly: true, maxAge: 0 }));
  jar.set(AUTH_STATUS_COOKIE, "", cookieOptions({ httpOnly: false, maxAge: 0 }));
}
