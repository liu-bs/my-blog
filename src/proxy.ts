/**
 * @file proxy.ts
 * @description Next.js 边缘代理（middleware）：对 PROTECTED_ROUTES（/write、/settings、/profile）
 * 做登录门槛检查，未登录（无 auth_token Cookie）时重定向到 /login 并通过 redirect 参数携带原目标地址。
 * 仅做 Cookie 存在性判断，token 有效性由服务端接口层校验；matcher 已排除静态资源与 /api 路由。
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE } from "@shared";
import { PROTECTED_ROUTES } from "@/config/site";

/**
 * 判断路径是否命中受保护路由（精确匹配或以 "路由/" 开头的子路径）
 * @param pathname 请求路径
 * @returns 是否需要登录才能访问
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * 代理入口：受保护路由缺少登录令牌时 302 到 /login?redirect=原路径
 * @param request 当前请求（读取 pathname 与 auth_token Cookie）
 * @returns 重定向响应或 NextResponse.next() 放行
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedRoute(pathname)) {
    const authToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!authToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

/** 代理生效范围 matcher：排除 _next 静态资源、/api 路由及各类静态文件扩展名 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|css|js|map)$).*)",
  ],
};
