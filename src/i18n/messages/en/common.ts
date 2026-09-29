/**
 * @file en/common.ts
 * @description 英文 - 跨模块复用的通用文案（通用按钮、空态提示、分类名映射），与 zh/common.ts 逐 key 对应
 */
import type { Messages } from "../zh/common";

const common: Messages = {
  /** 浮层 / 弹窗的关闭按钮 aria-label */
  close: "Close",
  /** 回到顶部按钮 aria-label */
  backToTop: "Back to top",
  /** 列表卡片上的「阅读全文」入口 */
  readMore: "Read more",
  /** 未登录时的提示语，与下方按钮 goLogin 搭配使用 */
  loginRequired: "Sign in needed",
  /** 未登录提示中的按钮文案，与提示语 loginRequired 配对 */
  goLogin: "Sign in",
  refresh: "Refresh",
  /** 通用操作失败的 toast 文案 */
  operationFailed: "Operation failed, please try again",
  back: "Back",
  /** 表单必填标记后缀 */
  required: "Required",
  /** 表单选填标记后缀 */
  optional: "Optional",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  /** 删除二次确认弹窗的确认按钮，措辞需比普通 delete 更强调不可撤销 */
  confirmDelete: "Confirm delete",
  /** 加载失败区块的重试按钮 */
  retry: "Retry",
  /** 文章置顶徽标 */
  pinned: "Pinned",

  /**
   * 分类名映射：key 是数据库 / 业务层存储的中文分类枚举值（不可翻译），value 是本语言的展示文案
   */
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
