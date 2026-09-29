/**
 * @file en/write.ts
 * @description 英文 - 写作 / 编辑页文案（标题、编辑器与预览、元信息表单、Markdown 工具栏、离开确认），与 zh/write.ts 逐 key 对应
 */
import type { Messages } from "../zh/write";

const write: Messages = {
  /** 编辑已有文章时的页面标题 */
  editTitle: "Edit post",
  /** 新建文章时的页面标题 */
  createTitle: "New post",
  /** 文章加载失败时的标题 */
  loadErrorTitle: "Failed to load post",
  /** 加载失败说明，引导返回重试 */
  loadErrorDesc: "Post not found. Go back and retry.",
  /** 顶部返回「我的文章」列表的按钮 */
  backToMyPosts: "My posts",
  /** 编辑器视图模式：仅显示编辑区 */
  viewEdit: "Edit only",
  /** 编辑器视图模式：仅显示预览区 */
  viewPreview: "Preview only",
  titlePlaceholder: "Post title",
  contentPlaceholder: "Start writing…",
  /** 预览区尚无内容时的占位文案 */
  noContent: "Nothing yet",
  /** 提交时标题为空的校验提示 */
  titleRequired: "Please enter a title",
  /** 提交时正文为空的校验提示 */
  contentRequired: "Please enter some content",

  /** 有未保存改动时离开页面的确认弹窗标题 */
  leaveConfirmTitle: "Unsaved changes",
  /** 离开确认弹窗描述，说明离开会丢失改动 */
  leaveConfirmDesc: "Leave without saving? Your changes will be lost.",
  /** 离开确认弹窗：留在当前页继续编辑 */
  keepEditing: "Keep editing",
  /** 离开确认弹窗：放弃改动并离开 */
  discardChanges: "Discard",
  categoryLabel: "Category",
  tagLabel: "Tags",
  /** 标签输入框的快捷键与数量上限提示，需与后端标签上限一致 */
  tagHint: "Enter to add · up to 5",
  tagPlaceholder: "Add a tag",
  /** 已选标签上的删除按钮 aria-label */
  removeTag: "Remove tag",
  coverLabel: "Cover image URL",
  /** 封面图链接的可选性提示 */
  coverHint: "Paste an image URL",
  /** 封面预览区域标题 */
  coverPreview: "Cover preview",
  /** 封面图加载失败提示 */
  coverPreviewFailed: "Image failed to load. Check the URL is reachable.",

  /** 封面链接格式校验失败提示，与 settings.avatarInvalid 的校验口径一致 */
  coverInvalid: "Enter an https image URL, or a site-relative /path",
  summaryLabel: "Summary",
  /** 摘要留空时的自动截取策略说明 */
  summaryHint: "Auto-excerpted if blank",
  summaryPlaceholder: "Summary for lists & sharing…",
  /** 字数与预估阅读时长，{count} 为当前正文字数，{minutes} 为预估分钟数 */
  charCount: "{count} chars · {minutes} min read",
  /** 保存已有草稿的按钮 */
  updateDraft: "Save",
  /** 新建文章首次存为草稿的按钮，与 updateDraft 文案相同但场景不同 */
  saveDraft: "Save",
  /** 将新建文章公开发布的按钮 */
  publishPost: "Publish",
  /** 更新已发布文章的按钮 */
  updatePost: "Update",

  /** Markdown 工具栏：加粗 */
  toolbarBold: "Bold (⌘B)",
  /** Markdown 工具栏：斜体 */
  toolbarItalic: "Italic (⌘I)",
  /** Markdown 工具栏：标题 */
  toolbarHeading: "Heading",
  /** Markdown 工具栏：链接 */
  toolbarLink: "Link (⌘K)",
  /** Markdown 工具栏：行内代码 */
  toolbarInlineCode: "Inline code",
  /** Markdown 工具栏：代码块 */
  toolbarCodeBlock: "Code block",
  /** Markdown 工具栏：列表 */
  toolbarList: "List",
  /** Markdown 工具栏：引用 */
  toolbarQuote: "Quote",
  /** 工具栏按钮插入到编辑器中的模板文本：加粗 */
  phBold: "Bold text",
  /** 工具栏按钮插入到编辑器中的模板文本：斜体 */
  phItalic: "Italic text",
  /** 工具栏按钮插入到编辑器中的模板文本：标题 */
  phHeading: "Heading",
  /** 工具栏按钮插入到编辑器中的模板文本：链接 */
  phLink: "Link text",
  /** 工具栏按钮插入到编辑器中的模板文本：列表项 */
  phList: "List item",
  /** 工具栏按钮插入到编辑器中的模板文本：引用 */
  phQuote: "Quote",
};

export default write;
