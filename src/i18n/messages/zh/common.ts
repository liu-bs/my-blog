/**
 * @file zh/common.ts
 * @description 中文 - 跨模块复用的通用文案（通用按钮、空态提示、分类名映射）
 */
const common = {
  /** 浮层 / 弹窗的关闭按钮 aria-label */
  close: "关闭",
  /** 回到顶部按钮 aria-label */
  backToTop: "回到顶部",
  /** 列表卡片上的「阅读全文」入口 */
  readMore: "阅读全文",
  /** 未登录时的提示语，与下方按钮 goLogin 搭配使用 */
  loginRequired: "需要登录",
  /** 未登录提示中的按钮文案，与提示语 loginRequired 配对 */
  goLogin: "去登录",
  refresh: "刷新",
  /** 通用操作失败的 toast 文案 */
  operationFailed: "操作失败，请重试",
  back: "返回",
  /** 表单必填标记后缀 */
  required: "必填",
  /** 表单选填标记后缀 */
  optional: "可选",
  save: "保存",
  cancel: "取消",
  edit: "编辑",
  delete: "删除",
  /** 删除二次确认弹窗的确认按钮，措辞需比普通 delete 更强调不可撤销 */
  confirmDelete: "确认删除",
  /** 加载失败区块的重试按钮 */
  retry: "重试",
  /** 文章置顶徽标 */
  pinned: "置顶",

  /**
   * 分类名映射：key 是数据库 / 业务层存储的中文分类枚举值，value 是该语言下的展示文案。
   * 英文包只翻译 value，key 必须保持中文原样，改动 key 会导致分类筛选失效
   */
  categoryNames: {
    技术: "技术",
    设计: "设计",
    生活: "生活",
    产品: "产品",
    创业: "创业",
    其他: "其他",
  },
};

export type Messages = typeof common;
export default common;
