/**
 * @file proxy.ts
 * @description Next.js 中间件：先由 next-intl 完成语言前缀的改写/重定向，再对受保护路由做登录拦截。
 * 由于 Next.js 只允许存在一个中间件入口，这里以「组合器」的方式把国际化和鉴权串在同一条链上
 */
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { AUTH_TOKEN_COOKIE } from "@/lib/authConstants";
import { PROTECTED_ROUTES } from "@/config/site";

/** next-intl 中间件实例：按 routing 配置处理无前缀路径的补全与语言协商 */
const intlMiddleware = createMiddleware(routing);

/**
 * 从路径中拆出语言与去掉语言后的裸路径
 * @description 首段命中支持的语言时视为显式前缀；否则记默认语言并保留原路径，
 * 使鉴权判断只关心裸路径，不受是否已补前缀影响
 * @param pathname 原始请求路径
 * @returns locale 当前语言、barePath 去掉语言前缀后的路径
 */
function extractLocale(pathname: string): { locale: string; barePath: string } {
  const firstSegment = pathname.split("/")[1] ?? "";
  if (routing.locales.includes(firstSegment as (typeof routing.locales)[number])) {
    return { locale: firstSegment, barePath: pathname.slice(firstSegment.length + 1) || "/" };
  }
  return { locale: routing.defaultLocale, barePath: pathname };
}

/**
 * 判断是否为受保护路由
 * @description 采用「等于自身或以其为前缀」的匹配，使 /settings/xxx 这类子路由同样被保护
 * @param barePath 去掉语言前缀的路径
 * @returns 需要登录时返回 true
 */
function isProtectedRoute(barePath: string): boolean {
  return PROTECTED_ROUTES.some((route) => barePath === route || barePath.startsWith(`${route}/`));
}

/**
 * 中间件主流程
 * @description 顺序：先执行 intlMiddleware 得到语言处理结果（它内部可能返回重定向或改写），
 * 再做鉴权；命中受保护路由且无登录 Cookie 时，直接返回跳转登录页的响应并带上回跳地址（含原查询串），
 * 否则放行 intl 响应。注意此处只做「有无 Cookie」的粗判，真正的令牌校验由服务端完成
 * @param request 进入中间件的请求
 * @returns 语言处理响应，或未登录时的登录页重定向响应
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const intlResponse = intlMiddleware(request);

  const { locale, barePath } = extractLocale(pathname);

  if (isProtectedRoute(barePath)) {
    const authToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (!authToken) {
      // 带上完整原始地址（含查询串），登录后能回到用户原本想去的页面
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlResponse;
}

/**
 * 中间件匹配范围
 * @description 负向匹配跳过无法用语言前缀处理的请求：Next.js 内部资源（_next/static、_next/image）、
 * 已自带 /api 前缀的接口，以及各类静态资源扩展名（图片、字体、样式、脚本、站点地图 xml、webmanifest 等），
 * 避免对这些请求做无意义的重写或触发鉴权重定向
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|css|js|map)$).*)",
  ],
};
