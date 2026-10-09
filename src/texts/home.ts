/**
 * @file home.ts
 * @description 首页（src/app/(home)/page.tsx）文案：主视觉区、近期文章区块及列表加载失败提示，
 * 经 messages.home 消费。
 */

/** 首页文案集合 */
const home = {
  /** 主视觉区块的无障碍区域标签 */
  heroSection: "首页主视觉",

  /** 主视觉大标题上方的小引导语 */
  heroKicker: "一本生活手记",
  /** 主视觉大标题，\n 为换行位置 */
  heroTitle: "把日子\n写成散文",
  /** 主视觉导语段落 */
  heroLead: "这里写得慢。一条路，一本书，一场雨，都配得上一整个下午。",

  /** 主视觉区去文章列表的主按钮 */
  browsePosts: "开始阅读",

  /** 主视觉区去写作页的次按钮（登录后可见） */
  startWriting: "开始写作",

  /** 近期文章区块的无障碍区域标签 */
  latestSection: "近期文章",

  /** 近期文章区块标题 */
  latestTitle: "近期文章",
  /** 近期文章区块副标题 */
  latestSubtitle: "最近写下的几篇",
  /** 区块标题右侧去列表页的链接 */
  viewAll: "查看全部",

  /** 带文章数的查看全部文案，{count} 为文章总数 */
  viewAllCount: "查看全部 {count} 篇",

  /** 首页文章列表加载失败时的提示标题 */
  loadErrorTitle: "文章加载失败",

  /** 首页文章列表加载失败时的提示描述 */
  loadErrorDesc: "网络异常或服务暂时不可用，请稍后刷新页面重试",
};

/** 首页文案默认导出 */
export default home;
