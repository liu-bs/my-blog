/**
 * @file url.ts
 * @description URL 与导航辅助纯函数：应用内历史判断、locale 前缀剥离、redirect 参数安全校验、路由高亮匹配与登录回跳链接拼装
 */

/**
 * 判断是否存在应用内历史（可安全返回上一页）
 * @returns 依据 Next Router 写入的 history.state.idx 判断，> 0 视为有应用内历史
 */
export function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx > 0 : window.history.length > 1;
}

/** 需剥离的 locale 路径前缀 */
const LOCALE_PREFIXES = ["/zh", "/en"];

/**
 * 剥离路径中的 locale 前缀（/zh、/en）
 * @param path 原路径
 * @returns 去前缀路径，根路径归一为 /
 */
export function stripLocalePrefix(path: string): string {
  for (const prefix of LOCALE_PREFIXES) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || "/";
  }
  return path;
}

/**
 * 校验并归一化 redirect 参数，仅放行站内路径
 * @param raw 原始 redirect 字符串
 * @returns 合法的站内路径；外链、协议相对路径与登录/注册页一律回退 /
 */
export function safeRedirect(raw: string): string {
  const bare = stripLocalePrefix(raw);
  const ok =
    bare.startsWith("/") && !bare.startsWith("//") && !["/login", "/register"].includes(bare);
  return ok ? bare : "/";
}

/**
 * 判断导航项是否激活；根路径精确匹配，其余按前缀匹配
 * @param pathname 当前路径
 * @param href 导航目标
 * @returns 是否激活
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/**
 * 拼装带 redirect 回跳参数的登录页路径
 * @param redirectPath 登录后回跳路径
 * @returns 如 /login?redirect=%2Fposts
 */
export function buildLoginRedirect(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}
