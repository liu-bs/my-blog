/**
 * @file MarkdownToolbar.tsx
 * @description Markdown 编辑工具栏：加粗/斜体/标题/链接/行内代码/代码块/列表/引用按钮，
 *              点击时把 before/after 标记与占位文案交给 onInsert（由 MarkdownPane 完成选区包裹插入）
 */
import { Bold, Italic, Heading, Link as LinkIcon, Code, Code2, List, Quote } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * MarkdownToolbar 组件入参
 */
interface MarkdownToolbarProps {
  /** 插入回调：before/after 为包裹标记，placeholder 为无选中文时的占位文案 */
  onInsert: (before: string, after?: string, placeholder?: string) => void;
}

/**
 * 工具按钮配置
 */
interface ToolButton {
  /** 按钮图标 */
  icon: typeof Bold;

  /** 按钮 i18n 标签 */
  labelKey:
    | "toolbarBold"
    | "toolbarItalic"
    | "toolbarHeading"
    | "toolbarLink"
    | "toolbarInlineCode"
    | "toolbarCodeBlock"
    | "toolbarList"
    | "toolbarQuote";

  /** 插入的前置标记 */
  before: string;

  /** 插入的后置标记 */
  after?: string;

  /** 无选中文时使用的占位文案 key */
  placeholderKey?: "phBold" | "phItalic" | "phHeading" | "phLink" | "phList" | "phQuote";
}

/** 工具按钮配置表（渲染顺序即展示顺序） */
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
 * MarkdownToolbar 编辑工具栏
 * @param onInsert 插入回调
 */
export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const t = useTranslations("write");

  return (
    <div className="flex flex-wrap gap-1.5">
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
            <tool.icon size={16} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
