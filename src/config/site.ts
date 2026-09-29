/**
 * @file site.ts
 * @description 站点级常量配置：SEO 基准地址、需登录路由、各页面分页与预生成上限、导航项。
 * 这些值同时被服务端（metadata、robots、sitemap、限流）与前端（导航、列表页）引用，修改会影响对应功能的行为
 */

/**
 * 站点对外基准地址
 * @description 用于生成 metadata 的 metadataBase、robots 与 sitemap 中的绝对 URL；
 * 未配置环境变量时回退到本地开发地址，因此生产环境必须设置 NEXT_PUBLIC_BASE_URL，否则站点地图会指向 localhost
 */
export const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * 需要登录才能访问的路由前缀
 * @description 由 middleware（proxy.ts）在路由前拦截：未携带登录 Cookie 时重定向到登录页并携带回跳地址；
 * 与语言前缀无关，匹配的是剥离前缀后的路径，因此这里只写裸路径
 */
export const PROTECTED_ROUTES = ["/write", "/settings", "/profile"];

/** 文章列表页每页条数；改动会直接影响列表分页与 SEO 分页链接 */
export const PAGE_SIZE = 9;

/** 首页文章卡片的展示条数；与列表页独立，便于首页保持更轻的首屏 */
export const HOME_PAGE_SIZE = 6;

/**
 * 文章详情页 SSG 预生成的参数上限
 * @description 取最新该数量文章与全部语言的笛卡尔积生成静态页，控制构建产物体积；超出部分走按需渲染
 */
export const STATIC_PARAMS_LIMIT = 100;

/** sitemap 单次拉取文章的数量上限，防止站点地图过大 */
export const SITEMAP_LIMIT = 20000;

/**
 * 刷新令牌接口的单 IP 限流阈值（次/分钟）
 * @description 供 /api/auth/refresh 防刷；过小会导致频繁误伤正常刷新，过大则削弱防刷效果
 */
export const REFRESH_RATE_LIMIT = 30;

/**
 * 顶部导航项
 * @description href 为不带语言前缀的站内路径（由 Link 自动补前缀）；key 对应 next-intl 中 nav 命名空间下的文案 key
 */
export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/posts", key: "posts" },
] as const;
