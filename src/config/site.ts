/**
 * @file site.ts
 * @description 站点全局常量：站点地址、受保护路由、分页大小、静态生成与 sitemap 上限、导航配置
 */

/** 站点访问地址，生产环境通过 NEXT_PUBLIC_BASE_URL 环境变量配置 */
export const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/** 受保护路由列表，未登录访问会被 proxy 重定向到登录页 */
export const PROTECTED_ROUTES = ["/write", "/settings", "/profile"];

/** 文章列表每页条数 */
export const PAGE_SIZE = 9;

/** 首页文章展示条数 */
export const HOME_PAGE_SIZE = 6;

/** 静态生成（generateStaticParams）的参数数量上限 */
export const STATIC_PARAMS_LIMIT = 100;

/** sitemap 生成的 URL 数量上限 */
export const SITEMAP_LIMIT = 20000;

/** token 刷新接口限流阈值 */
export const REFRESH_RATE_LIMIT = 30;

/**
 * 顶部导航链接：href 为路由路径，key 为 i18n 词条键
 */
export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/posts", key: "posts" },
] as const;
