/**
 * @file zh/errors.ts
 * @description 中文 - 错误边界与错误页文案（500 兜底页、404 页、列表 / 详情加载失败、未登录提示）
 */
const errors = {
  /** 全局错误边界的标题 */
  errorTitle: "出错了",
  errorDesc: "页面加载失败，请稍后重试。",
  /** 错误页的重新加载按钮 */
  reload: "重新加载",
  /** 错误页返回首页的按钮 */
  goHome: "返回首页",
  /** 复制错误详情按钮，用于向维护者反馈 */
  copyError: "复制错误信息",
  /** 复制成功后的按钮反馈文案 */
  copied: "已复制",
  /** 404 页描述 */
  notFoundDesc: "页面不存在或已移动。",
  /** 404 页跳转文章列表的按钮 */
  browsePosts: "浏览文章",
  /** 文章列表页加载失败的标题 */
  postsErrorTitle: "文章加载失败",
  postsErrorDesc: "网络异常，请稍后重试。",
  /** 文章详情页加载失败的标题 */
  postErrorTitle: "文章加载失败",
  /** 文章详情页加载失败的描述，引导返回列表 */
  postErrorDesc: "文章加载失败，请返回列表。",
  /** 文章详情失败页返回列表的按钮 */
  backToList: "返回文章列表",
  /** 未登录访问个人中心 / 写作 / 设置时的提示说明 */
  dashboardLoginDesc: "登录后可访问个人中心、写作和设置。",
};

export type Messages = typeof errors;
export default errors;
