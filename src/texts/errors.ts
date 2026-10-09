/**
 * @file errors.ts
 * @description 错误边界与未找到页面的文案（src/app/error.tsx、global-error.tsx、not-found.tsx、
 * posts/error.tsx、posts/[id]/error.tsx），经 messages.errors 消费。
 */

/** 错误页文案集合 */
const errors = {
  /** 通用错误边界页标题（error.tsx） */
  errorTitle: "出错了",
  /** 通用错误边界页描述 */
  errorDesc: "页面加载失败，请稍后重试。",

  /** 错误页重新加载按钮文案 */
  reload: "重新加载",

  /** 错误页/not-found 页的返回首页按钮 */
  goHome: "返回首页",

  /** 错误页复制错误堆栈信息的按钮文案 */
  copyError: "复制错误信息",

  /** 复制成功后的按钮反馈文案 */
  copied: "已复制",

  /** not-found 页描述（页面不存在或已移动） */
  notFoundDesc: "页面不存在或已移动。",

  /** not-found 页去文章列表的引导按钮 */
  browsePosts: "浏览文章",

  /** 文章列表页错误边界标题（posts/error.tsx） */
  postsErrorTitle: "文章加载失败",
  /** 文章列表页错误边界描述 */
  postsErrorDesc: "网络异常，请稍后重试。",

  /** 文章详情页错误边界标题（posts/[id]/error.tsx） */
  postErrorTitle: "文章加载失败",

  /** 文章详情页错误边界描述 */
  postErrorDesc: "文章加载失败，请返回列表。",

  /** 文章详情错误页返回文章列表的按钮 */
  backToList: "返回文章列表",

  /** 个人中心登录门槛页的描述文案（AuthGate 未登录态） */
  dashboardLoginDesc: "登录后可访问个人中心、写作和设置。",
};

/** 错误页文案默认导出 */
export default errors;
