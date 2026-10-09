import "server-only";

/**
 * @file 认证 Cookie 读写工具
 * @description 统一管理两个认证 Cookie：AUTH_TOKEN_COOKIE（httpOnly，存放 JWT，服务端签名生成）
 * 与 AUTH_STATUS_COOKIE（非 httpOnly，仅供前端快速判断登录态，不承载安全语义）。
 * 提供 NextResponse（Route Handler 场景）与 cookie jar（Server Action / RSC 场景）两种写入载体。
 */

import type { NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import type { User } from "@shared";
import { tokenService } from "./token.service";
import { AUTH_TOKEN_COOKIE, AUTH_STATUS_COOKIE } from "@shared";
import { env } from "@server/common/config/env";

/**
 * 生成认证 Cookie 的公共选项
 * @description 生产环境强制 secure；sameSite=lax 兼顾重定向回跳；httpOnly 由调用方按 Cookie 用途指定
 * @param overrides 需要覆盖的项：httpOnly 标记及可选 maxAge（登出时传 0 立即过期）
 * @returns 可展开给 cookie 设置 API 的选项对象
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
 * 在 Route Handler 响应上写入登录态 Cookie
 * @param res 待设置 Cookie 的 NextResponse
 * @param user 刚通过认证的用户（tokenVersion 参与 JWT 签发，用于强制下线）
 */
export function setAuthCookies(res: NextResponse, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  res.cookies.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  res.cookies.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 在 Server Action / RSC 的 cookie jar 上写入登录态 Cookie
 * @param jar next/headers 的 cookies() 返回的可写 jar
 * @param user 刚通过认证的用户
 */
export function setAuthCookiesToJar(jar: ReadonlyRequestCookies, user: User): void {
  const token = tokenService.generate({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
  jar.set(AUTH_TOKEN_COOKIE, token, cookieOptions({ httpOnly: true }));
  jar.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

/**
 * 清空 cookie jar 上的登录态 Cookie（置空值 + maxAge=0 使其立即过期）
 * @param jar next/headers 的 cookies() 返回的可写 jar
 */
export function clearAuthCookiesFromJar(jar: ReadonlyRequestCookies): void {
  jar.set(AUTH_TOKEN_COOKIE, "", cookieOptions({ httpOnly: true, maxAge: 0 }));
  jar.set(AUTH_STATUS_COOKIE, "", cookieOptions({ httpOnly: false, maxAge: 0 }));
}
