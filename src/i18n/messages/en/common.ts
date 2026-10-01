/**
 * @file common.ts
 * @description 英文文案 - 通用词条：全局复用的操作按钮、状态提示及分类名映射，供各页面共享
 */
import type { Messages } from "../zh/common";

/**
 * 通用文案集合
 */
const common: Messages = {
  close: "Close",

  backToTop: "Back to top",

  readMore: "Read more",

  loginRequired: "Sign in needed",

  goLogin: "Sign in",
  refresh: "Refresh",

  operationFailed: "Operation failed, please try again",
  back: "Back",

  required: "Required",

  optional: "Optional",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",

  confirmDelete: "Confirm delete",

  retry: "Retry",

  pinned: "Pinned",

  categoryNames: {
    技术: "Technology",
    设计: "Design",
    生活: "Life",
    产品: "Product",
    创业: "Startup",
    其他: "Other",
  },
};

export default common;
