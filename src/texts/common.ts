/**
 * @file common.ts
 * @description 全站通用控件文案（按钮、开关、状态标记等），
 * 经 @/texts 的 messages.common 命名空间被 Modal、BackToTop、FormField、PinnedBadge 等各页面组件复用。
 */

/** 通用控件文案集合 */
const common = {
  /** Modal 弹窗关闭按钮文案/无障碍标签 */
  close: "关闭",

  /** 文章页右下角回到顶部悬浮按钮的无障碍标签（BackToTop） */
  backToTop: "回到顶部",

  /** 文章卡片上的阅读全文链接文案（ArticleCard） */
  readMore: "阅读全文",

  /** 需登录才能继续的提示块标题（LoginRequired/AuthGate） */
  loginRequired: "需要登录",

  /** 登录提示块中去往登录页的按钮文案 */
  goLogin: "去登录",
  /** 加载失败时刷新重试按钮文案（文章列表等） */
  refresh: "刷新",

  /** 通用操作失败 toast 兜底文案（lib/toast） */
  operationFailed: "操作失败，请重试",

  /** 返回上一页链接文案（BackLink） */
  back: "返回",

  /** 表单字段的必填标记（FormField） */
  required: "必填",

  /** 表单字段的可选标记（FormField） */
  optional: "可选",
  /** 通用保存按钮 */
  save: "保存",
  /** 通用取消按钮 */
  cancel: "取消",
  /** 通用编辑按钮 */
  edit: "编辑",
  /** 通用删除按钮 */
  delete: "删除",

  /** 删除确认弹窗的标题（Modal） */
  confirmDelete: "确认删除",

  /** 请求/加载失败后的重试按钮 */
  retry: "重试",

  /** 文章卡片置顶角标文案（PinnedBadge） */
  pinned: "置顶",
};

/** 通用控件文案默认导出 */
export default common;
