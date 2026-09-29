/**
 * @file url.ts
 * @description URL 相关的小工具：站点内历史栈判断、语言前缀剥离、回跳地址白名单校验与登录地址拼装
 */

/**
 * 判断站内历史栈中是否还有上一页
 * @description 优先读 Next.js 写入的 history.state.idx（0 表示这是站内第一页），不可用时退化为 history.length；
 * 用于决定「返回」按钮是走 router.back() 还是直接跳列表页
 * @returns 存在站内可回退的历史时返回 true
 */
export function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx > 0 : window.history.length > 1;
}

/** 应用支持的语言路径前缀，与 i18n 路由配置保持一致 */
const LOCALE_PREFIXES = ["/zh", "/en"];

/**
 * 剥离路径上的语言前缀
 * @param path 可能带语言前缀的路径
 * @returns 去掉前缀后的路径；`/zh` 本身归一为 `/`
 */
export function stripLocalePrefix(path: string): string {
  for (const prefix of LOCALE_PREFIXES) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || "/";
  }
  return path;
}

/**
 * 校验并归一化登录回跳地址
 * @description 安全约束：必须是站内绝对路径（以 / 开头）、不能是协议相对地址（// 开头，会被浏览器当作外域跳转）、
 * 且不能指回登录/注册页自身（否则登录成功后会再次回到登录页形成循环）；不满足时一律退回首页
 * @param raw 待校验的原始回跳地址（通常来自 query 参数，不可信）
 * @returns 安全的站内路径（已剥离语言前缀，由调用方自行补前缀）
 */
export function safeRedirect(raw: string): string {
  const bare = stripLocalePrefix(raw);
  const ok =
    bare.startsWith("/") && !bare.startsWith("//") && !["/login", "/register"].includes(bare);
  return ok ? bare : "/";
}

/**
 * 判断导航项是否处于激活态
 * @param pathname 当前路径
 * @param href 导航项目标路径
 * @returns 首页要求完全相等（否则所有页面都会激活首页）；其余按前缀匹配以覆盖子路由
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/**
 * 生成带回跳参数的登录地址（不含语言前缀）
 * @param redirectPath 登录成功后的目标路径
 * @returns 形如 `/login?redirect=%2Fposts` 的地址；调用方需自行拼接语言前缀
 */
export function buildLoginRedirect(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}
