/**
 * @file MarkdownToolbar.tsx
 * @description Markdown 源码编辑器的语法工具栏：把每个按钮抽象成「前置片段 + 可选闭合片段 + 可选占位文案」的数据，
 *              点击时统一交给父级的 onInsert 处理，本组件不感知 textarea、不改动正文，也不负责光标定位
 */
import { Bold, Italic, Heading, Link as LinkIcon, Code, Code2, List, Quote } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * MarkdownToolbar 组件入参
 */
interface MarkdownToolbarProps {
  /**
   * 插入 Markdown 语法的回调
   * @param before 插入到主体前的语法片段
   * @param after 插入到主体后的闭合片段，缺省表示无闭合
   * @param placeholder 无选中文本时填入的占位文案
   */
  onInsert: (before: string, after?: string, placeholder?: string) => void;
}

/**
 * 单个工具栏按钮的配置
 * @description 用数据描述语法片段，新增按钮只需往 TOOLS 里追加一项，无需改动渲染逻辑
 */
interface ToolButton {
  /** 按钮图标组件，需接受 size / strokeWidth 等 svg 属性 */
  icon: typeof Bold;

  /** 按钮无障碍标签与 tooltip 的 i18n key，命名空间为 write */
  labelKey:
    | "toolbarBold"
    | "toolbarItalic"
    | "toolbarHeading"
    | "toolbarLink"
    | "toolbarInlineCode"
    | "toolbarCodeBlock"
    | "toolbarList"
    | "toolbarQuote";

  /** 插入到主体前的语法片段 */
  before: string;

  /** 插入到主体后的闭合片段，如加粗的 `**`；缺省表示该语法无需闭合 */
  after?: string;

  /** 无选中文本时填入的占位文案 i18n key；缺省表示该语法不需要占位（如行内代码） */
  placeholderKey?: "phBold" | "phItalic" | "phHeading" | "phLink" | "phList" | "phQuote";
}

/** 工具栏按钮清单，顺序即为界面从左到右的展示顺序 */
const TOOLS: ToolButton[] = [
  { icon: Bold, labelKey: "toolbarBold", before: "**", after: "**", placeholderKey: "phBold" },
  { icon: Italic, labelKey: "toolbarItalic", before: "*", after: "*", placeholderKey: "phItalic" },
  { icon: Heading, labelKey: "toolbarHeading", before: "### ", placeholderKey: "phHeading" },
  {
    icon: LinkIcon,
    labelKey: "toolbarLink",
    before: "[",
    after: "](https://)",
    placeholderKey: "phLink",
  },
  { icon: Code, labelKey: "toolbarInlineCode", before: "`", after: "`" },
  { icon: Code2, labelKey: "toolbarCodeBlock", before: "```js\n", after: "\n```" },
  { icon: List, labelKey: "toolbarList", before: "- ", placeholderKey: "phList" },
  { icon: Quote, labelKey: "toolbarQuote", before: "> ", placeholderKey: "phQuote" },
];

/**
 * MarkdownToolbar Markdown 语法工具栏
 * @description 纯展示 + 事件上抛组件：把 TOOLS 逐项渲染为图标按钮，点击时按配置拼装参数调用 {@link MarkdownToolbarProps.onInsert}，
 *              真正的文本改写与光标保持由父级 MarkdownPane 完成
 * @param props {@link MarkdownToolbarProps}
 * @returns 自动换行的图标按钮组
 */
export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const t = useTranslations("write");

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* 遍历按钮配置渲染；key 用 labelKey 保证稳定且跨语言不重复 */}
      {TOOLS.map((tool) => {
        const label = t(tool.labelKey);

        return (
          <button
            key={tool.labelKey}
            type="button"
            title={label}
            aria-label={label}
            onClick={() =>
              onInsert(
                tool.before,
                tool.after,
                tool.placeholderKey ? t(tool.placeholderKey) : undefined,
              )
            }
            className="icon-btn-ghost"
          >
            {/* 图标仅作视觉提示，语义由 button 的 aria-label 承载 */}
            <tool.icon size={16} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
