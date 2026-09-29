/**
 * @file zh/write.ts
 * @description 中文 - 写作 / 编辑页文案（标题、编辑器与预览、元信息表单、Markdown 工具栏、离开确认）
 */
const write = {
  /** 编辑已有文章时的页面标题 */
  editTitle: "编辑文章",
  /** 新建文章时的页面标题 */
  createTitle: "新建文章",
  /** 文章加载失败时的标题 */
  loadErrorTitle: "文章加载失败",
  /** 加载失败说明，引导返回重试 */
  loadErrorDesc: "文章加载失败，请返回重试",
  /** 顶部返回「我的文章」列表的按钮 */
  backToMyPosts: "返回文章",
  /** 编辑器视图模式：仅显示编辑区 */
  viewEdit: "仅编辑",
  /** 编辑器视图模式：仅显示预览区 */
  viewPreview: "仅预览",
  titlePlaceholder: "输入标题",
  contentPlaceholder: "开始写作…",
  /** 预览区尚无内容时的占位文案 */
  noContent: "暂无内容",
  /** 提交时标题为空的校验提示 */
  titleRequired: "请输入文章标题",
  /** 提交时正文为空的校验提示 */
  contentRequired: "请输入文章内容",

  /** 有未保存改动时离开页面的确认弹窗标题 */
  leaveConfirmTitle: "未保存的更改",
  /** 离开确认弹窗描述，说明离开会丢失改动 */
  leaveConfirmDesc: "更改尚未保存，离开后将丢失，确定要离开吗？",
  /** 离开确认弹窗：留在当前页继续编辑 */
  keepEditing: "继续编辑",
  /** 离开确认弹窗：放弃改动并离开 */
  discardChanges: "放弃更改",
  categoryLabel: "分类",
  tagLabel: "标签",
  /** 标签输入框的快捷键与数量上限提示，需与后端标签上限一致 */
  tagHint: "回车添加 · 最多 5 个",
  tagPlaceholder: "添加标签",
  /** 已选标签上的删除按钮 aria-label */
  removeTag: "删除标签",
  coverLabel: "封面图链接",
  /** 封面图链接的可选性提示 */
  coverHint: "可选 · 输入图片链接",
  /** 封面预览区域标题 */
  coverPreview: "封面预览",
  /** 封面图加载失败提示 */
  coverPreviewFailed: "图片无法加载，请检查链接是否可访问",

  /** 封面链接格式校验失败提示，与 settings.avatarInvalid 的校验口径一致 */
  coverInvalid: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  summaryLabel: "摘要",
  /** 摘要留空时的自动截取策略说明 */
  summaryHint: "留空则自动截取正文",
  summaryPlaceholder: "输入摘要，用于列表与分享…",
  /** 字数与预估阅读时长，{count} 为当前正文字数，{minutes} 为预估分钟数 */
  charCount: "{count} 字 · 约 {minutes} 分钟",
  /** 保存已有草稿的按钮 */
  updateDraft: "保存草稿",
  /** 新建文章首次存为草稿的按钮，与 updateDraft 文案相同但场景不同 */
  saveDraft: "保存草稿",
  /** 将新建文章公开发布的按钮 */
  publishPost: "发布",
  /** 更新已发布文章的按钮 */
  updatePost: "更新",

  /** Markdown 工具栏：加粗 */
  toolbarBold: "加粗 (⌘B)",
  /** Markdown 工具栏：斜体 */
  toolbarItalic: "斜体 (⌘I)",
  /** Markdown 工具栏：标题 */
  toolbarHeading: "标题",
  /** Markdown 工具栏：链接 */
  toolbarLink: "链接 (⌘K)",
  /** Markdown 工具栏：行内代码 */
  toolbarInlineCode: "行内代码",
  /** Markdown 工具栏：代码块 */
  toolbarCodeBlock: "代码块",
  /** Markdown 工具栏：列表 */
  toolbarList: "列表",
  /** Markdown 工具栏：引用 */
  toolbarQuote: "引用",
  /** 工具栏按钮插入到编辑器中的模板文本：加粗 */
  phBold: "加粗文字",
  /** 工具栏按钮插入到编辑器中的模板文本：斜体 */
  phItalic: "斜体文字",
  /** 工具栏按钮插入到编辑器中的模板文本：标题 */
  phHeading: "标题文字",
  /** 工具栏按钮插入到编辑器中的模板文本：链接 */
  phLink: "链接文字",
  /** 工具栏按钮插入到编辑器中的模板文本：列表项 */
  phList: "列表项",
  /** 工具栏按钮插入到编辑器中的模板文本：引用 */
  phQuote: "引用内容",
};

export type Messages = typeof write;
export default write;
