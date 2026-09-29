/**
 * @file zh/home.ts
 * @description 中文 - 首页文案（主视觉区、最新文章区块、加载失败态）
 */
const home = {
  /** 主视觉 <section> 的 aria-label */
  heroSection: "首页主视觉",
  /** 主视觉上方的小标签 */
  heroBadge: "技术写作 · 工程笔记",
  /** 主视觉里展示的代码示例文本，含行注释前缀 "//"，是展示内容而非代码注释，勿删 */
  codeComment: "// 鉴权守卫：Cookie 校验 + 注入 user",
  /** 主视觉副标题上方的小字 */
  heroKicker: "专注手艺的人",
  heroTitle: "工程的深笔记",
  heroLead: "记录值得反复回味的工程思考。",
  /** 主视觉按钮，跳转文章列表 */
  browsePosts: "浏览文章",
  /** 主视觉按钮，跳转写作页 */
  startWriting: "开始写作",
  /** 最新文章区块的 aria-label */
  latestSection: "近期文章",
  /** 最新文章区块的可见标题 */
  latestTitle: "近期文章",
  latestSubtitle: "最新的工程思考与实践记录",
  viewAll: "查看全部",
  /** 查看全部入口的 count 为文章总数占位符 */
  viewAllCount: "查看全部 {count} 篇",
  /** 文章列表加载失败时的标题 */
  loadErrorTitle: "文章加载失败",
  /** 加载失败的说明文案 */
  loadErrorDesc: "网络异常或服务暂时不可用，请稍后刷新页面重试",
};

export type Messages = typeof home;
export default home;
