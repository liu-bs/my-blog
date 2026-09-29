/**
 * @file en/errors.ts
 * @description 英文 - 错误边界与错误页文案（500 兜底页、404 页、列表 / 详情加载失败、未登录提示），与 zh/errors.ts 逐 key 对应
 */
import type { Messages } from "../zh/errors";

const errors: Messages = {
  /** 全局错误边界的标题 */
  errorTitle: "Something went wrong",
  errorDesc: "Failed to load. Try again shortly.",
  /** 错误页的重新加载按钮 */
  reload: "Reload",
  /** 错误页返回首页的按钮 */
  goHome: "Home",
  /** 复制错误详情按钮，用于向维护者反馈 */
  copyError: "Copy error details",
  /** 复制成功后的按钮反馈文案 */
  copied: "Copied",
  /** 404 页描述 */
  notFoundDesc: "Page not found or moved.",
  /** 404 页跳转文章列表的按钮 */
  browsePosts: "Browse posts",
  /** 文章列表页加载失败的标题 */
  postsErrorTitle: "Failed to load posts",
  postsErrorDesc: "Network error. Refresh and try again.",
  /** 文章详情页加载失败的标题 */
  postErrorTitle: "Failed to load post",
  /** 文章详情页加载失败的描述，引导返回列表 */
  postErrorDesc: "Post not found. Go back to the list.",
  /** 文章详情失败页返回列表的按钮 */
  backToList: "All posts",
  /** 未登录访问个人中心 / 写作 / 设置时的提示说明 */
  dashboardLoginDesc: "Sign in to access your profile, posts and settings.",
};

export default errors;
