/**
 * @file site.ts
 * @description 站点级配置常量：站点 URL、路由访问控制、分页大小与限流参数，供服务端与客户端共同引用
 */

/** 站点对外绝对地址，用于 SEO/sitemap/RSS；缺省取本地开发地址 */
export const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/** 需登录才能访问的路由前缀列表（middleware 层拦截） */
export const PROTECTED_ROUTES = ["/write", "/settings", "/profile"];

/** 帖子列表/分类页通用分页大小 */
export const PAGE_SIZE = 9;

/** 首页精选帖子展示数量 */
export const HOME_PAGE_SIZE = 6;

/** 评论分页每页条数 */
export const COMMENT_PAGE_SIZE = 10;

/** generateStaticParams 单次预渲染的帖子数上限 */
export const STATIC_PARAMS_LIMIT = 100;

/** sitemap 单次输出的 URL 条数上限 */
export const SITEMAP_LIMIT = 20000;

/** token 刷新接口限流阈值：每 IP 每分钟最多 30 次（窗口 60s，见 /api/auth/refresh 路由） */
export const REFRESH_RATE_LIMIT = 30;

/** 顶部导航链接配置，key 对应文案字典 */
export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/posts", key: "posts" },
] as const;
