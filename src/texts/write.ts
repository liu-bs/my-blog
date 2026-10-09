/**
 * @file write.ts
 * @description 写作页（src/app/(dashboard)/write，WriteEditor 及 dashboard/write 子组件）文案：
 * 编辑器标题、视图切换、元信息表单、封面/摘要、Markdown 工具栏与未保存离开确认，经 messages.write 消费。
 */

/** 写作页文案集合 */
const write = {
  /** 携带文章 id（编辑模式）时的页面标题 */
  editTitle: "编辑文章",

  /** 新建文章时的页面标题 */
  createTitle: "新建文章",

  /** 编辑已有文章加载失败时的提示标题 */
  loadErrorTitle: "文章加载失败",

  /** 编辑已有文章加载失败时的提示描述 */
  loadErrorDesc: "文章加载失败，请返回重试",

  /** 加载失败后返回个人中心的链接 */
  backToMyPosts: "返回文章",

  /** 视图切换：仅编辑模式按钮 */
  viewEdit: "仅编辑",

  /** 视图切换：仅预览模式按钮 */
  viewPreview: "仅预览",
  /** 标题输入框占位符 */
  titlePlaceholder: "输入标题",
  /** 正文编辑器占位符 */
  contentPlaceholder: "开始写作…",

  /** 预览区无内容时的占位文案 */
  noContent: "暂无内容",

  /** 保存/发布时标题为空的校验提示 */
  titleRequired: "请输入文章标题",

  /** 保存/发布时正文为空的校验提示 */
  contentRequired: "请输入文章内容",

  /** 未保存离开确认弹窗标题（UnsavedChangesDialog） */
  leaveConfirmTitle: "未保存的更改",

  /** 未保存离开确认弹窗描述 */
  leaveConfirmDesc: "更改尚未保存，离开后将丢失，确定要离开吗？",

  /** 确认弹窗：留在页面继续编辑 */
  keepEditing: "继续编辑",

  /** 确认弹窗：放弃更改并离开 */
  discardChanges: "放弃更改",
  /** 元信息表单：分类字段标签（PostMetaFields） */
  categoryLabel: "分类",
  /** 元信息表单：标签字段标签 */
  tagLabel: "标签",

  /** 标签输入框下方操作提示 */
  tagHint: "回车添加 · 最多 5 个",
  /** 标签输入框占位符 */
  tagPlaceholder: "添加标签",

  /** 已添加标签上删除按钮的无障碍标签 */
  removeTag: "删除标签",
  /** 封面图表单字段标签（CoverField） */
  coverLabel: "封面图链接",

  /** 封面图输入框下方提示 */
  coverHint: "可选 · 输入图片链接",

  /** 封面预览图的无障碍标签 */
  coverPreview: "封面预览",

  /** 封面预览图加载失败时的提示 */
  coverPreviewFailed: "图片无法加载，请检查链接是否可访问",

  /** 封面链接格式校验错误 */
  coverInvalid: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  /** 摘要字段标签 */
  summaryLabel: "摘要",

  /** 摘要输入框下方提示（留空自动生成） */
  summaryHint: "留空则自动截取正文",
  /** 摘要输入框占位符 */
  summaryPlaceholder: "输入摘要，用于列表与分享…",

  /** 编辑器底部字数统计，{count} 为字数、{minutes} 为预计阅读分钟数 */
  charCount: "{count} 字 · 约 {minutes} 分钟",

  /** 编辑已有草稿时的保存按钮 */
  updateDraft: "保存草稿",

  /** 新建时的保存草稿按钮 */
  saveDraft: "保存草稿",

  /** 新建文章的发布按钮 */
  publishPost: "发布",

  /** 编辑已有文章的更新按钮 */
  updatePost: "更新",

  /** Markdown 工具栏：加粗按钮（MarkdownToolbar） */
  toolbarBold: "加粗 (⌘B)",

  /** Markdown 工具栏：斜体按钮 */
  toolbarItalic: "斜体 (⌘I)",

  /** Markdown 工具栏：标题按钮 */
  toolbarHeading: "标题",

  /** Markdown 工具栏：链接按钮 */
  toolbarLink: "链接 (⌘K)",

  /** Markdown 工具栏：行内代码按钮 */
  toolbarInlineCode: "行内代码",

  /** Markdown 工具栏：代码块按钮 */
  toolbarCodeBlock: "代码块",

  /** Markdown 工具栏：无序列表按钮 */
  toolbarList: "列表",

  /** Markdown 工具栏：引用按钮 */
  toolbarQuote: "引用",

  /** 插入加粗语法时的占位文字 */
  phBold: "加粗文字",

  /** 插入斜体语法时的占位文字 */
  phItalic: "斜体文字",

  /** 插入标题语法时的占位文字 */
  phHeading: "标题文字",

  /** 插入链接语法时的占位文字 */
  phLink: "链接文字",

  /** 插入列表项时的占位文字 */
  phList: "列表项",

  /** 插入引用语法时的占位文字 */
  phQuote: "引用内容",
};

/** 写作页文案默认导出 */
export default write;
