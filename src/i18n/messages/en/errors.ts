/**
 * @file errors.ts
 * @description 英文文案 - 错误与异常边界：全局 error/not-found 页面、文章加载失败及登录引导提示
 */
import type { Messages } from "../zh/errors";

/**
 * 错误页面文案集合
 */
const errors: Messages = {
  errorTitle: "Something went wrong",
  errorDesc: "Failed to load. Try again shortly.",

  reload: "Reload",

  goHome: "Home",

  copyError: "Copy error details",

  copied: "Copied",

  notFoundDesc: "Page not found or moved.",

  browsePosts: "Browse posts",

  postsErrorTitle: "Failed to load posts",
  postsErrorDesc: "Network error. Refresh and try again.",

  postErrorTitle: "Failed to load post",

  postErrorDesc: "Post not found. Go back to the list.",

  backToList: "All posts",

  dashboardLoginDesc: "Sign in to access your profile, posts and settings.",
};

export default errors;
