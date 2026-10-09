/**
 * @file url.ts
 * @description URL/路由小工具：判断应用内历史可后退、登录回跳地址安全校验（防开放重定向）、导航激活态判断与登录跳转链接构建
 */

/**
 * 判断是否存在可后退的应用内历史
 * @returns Next.js history.state.idx 大于 0，或无 idx 时 history.length 大于 1，返回 true
 * @warning 依赖浏览器环境；SSR（window 未定义）时返回 false
 */
export function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  // Next.js App Router 会在 history.state 维护栈内索引 idx
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx > 0 : window.history.length > 1;
}

/**
 * 校验并归一化登录/注册后的回跳地址
 * @param raw 待校验的 redirect 查询参数
 * @returns 合法的内部路径原样返回；协议相对路径（//xxx）、绝对 URL、登录注册页自身或非法值一律归一为 "/"
 * @warning 白名单策略防开放重定向：仅接受以单个 / 开头的站内路径
 */
export function safeRedirect(raw: string): string {
  const ok = raw.startsWith("/") && !raw.startsWith("//") && !["/login", "/register"].includes(raw);
  return ok ? raw : "/";
}

/**
 * 判断导航项是否处于激活态
 * @param pathname 当前路径
 * @param href 导航目标路径
 * @returns 首页要求精确匹配；其余路径按前缀匹配（/posts 高亮 /posts/xxx）
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/**
 * 构建登录页跳转链接
 * @param redirectPath 登录成功后回跳的目标路径
 * @returns 形如 /login?redirect=%2Fposts%2Fabc 的链接（参数已 encodeURIComponent）
 */
export function buildLoginRedirect(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}
