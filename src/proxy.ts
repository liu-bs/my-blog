/**
 * @file proxy.ts
 * @description Next.js 16 请求代理（替代 middleware）：先由 next-intl 处理 locale 检测与重定向，再对受保护路由（write/settings/profile）校验登录 token，无 token 时 302 到当前语言的登录页并携带 redirect 回跳参数
 */
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { AUTH_TOKEN_COOKIE } from "@/lib/authConstants";
import { PROTECTED_ROUTES } from "@/config/site";

/** next-intl 语言中间件：locale 协商、重定向与 cookie 写入 */
const intlMiddleware = createMiddleware(routing);

/**
 * 从路径解析 locale 与去前缀路径
 * @param pathname 请求路径
 * @returns locale（无前缀时为默认语言）与 barePath（去 locale 前缀的路径）
 */
function extractLocale(pathname: string): { locale: string; barePath: string } {
  const firstSegment = pathname.split("/")[1] ?? "";
  if (routing.locales.includes(firstSegment as (typeof routing.locales)[number])) {
    return { locale: firstSegment, barePath: pathname.slice(firstSegment.length + 1) || "/" };
  }
  return { locale: routing.defaultLocale, barePath: pathname };
}

/**
 * 判断（去 locale 前缀后的）路径是否为受保护路由
 * @param barePath 去 locale 前缀的路径
 * @returns 是否受保护（精确匹配或以其为前缀的子路径）
 */
function isProtectedRoute(barePath: string): boolean {
  return PROTECTED_ROUTES.some((route) => barePath === route || barePath.startsWith(`${route}/`));
}

/**
 * 请求入口：先走 intl 中间件，再对受保护路由做登录校验
 * @param request 请求对象
 * @returns intl 响应，受保护路由无 token 时返回登录页重定向
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const intlResponse = intlMiddleware(request);

  const { locale, barePath } = extractLocale(pathname);

  if (isProtectedRoute(barePath)) {
    const authToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!authToken) {
      // 无 token：302 到当前语言的登录页并携带回跳地址
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlResponse;
}

/**
 * 代理生效范围：排除 _next 静态资源、api 路由与常见静态文件
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|css|js|map)$).*)",
  ],
};
