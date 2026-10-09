/**
 * @file MarkdownToolbar.tsx
 * @description Markdown 编辑工具栏：渲染加粗/斜体/标题/链接/行内码/代码块/列表/引用等格式化按钮，点击后回调插入对应语法标记
 * @usage 纯展示组件，无状态；由 MarkdownPane 传入 onInsert 完成实际文本插入，文案取自 messages.write
 */
import { Bold, Italic, Heading, Link as LinkIcon, Code, Code2, List, Quote } from "lucide-react";
import { messages } from "@/texts";

/** MarkdownToolbar 组件入参 */
interface MarkdownToolbarProps {
  /** 点击工具按钮时回调，传入需包裹的前缀/后缀与占位文本 */
  onInsert: (before: string, after?: string, placeholder?: string) => void;
}

/** 单个工具按钮的配置描述 */
interface ToolButton {
  /** 按钮图标组件（lucide 图标） */
  icon: typeof Bold;

  /** 按钮提示文案在 messages.write 中的键 */
  labelKey:
    | "toolbarBold"
    | "toolbarItalic"
    | "toolbarHeading"
    | "toolbarLink"
    | "toolbarInlineCode"
    | "toolbarCodeBlock"
    | "toolbarList"
    | "toolbarQuote";

  /** 插入语法的前缀标记 */
  before: string;

  /** 插入语法的后缀标记（成对语法时使用） */
  after?: string;

  /** 无选区时插入的占位文本在 messages.write 中的键 */
  placeholderKey?: "phBold" | "phItalic" | "phHeading" | "phLink" | "phList" | "phQuote";
}

/** 工具栏按钮配置表，决定按钮顺序与各自的 Markdown 语法 */
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
 * Markdown 编辑工具栏
 * @param props.onInsert 文本插入回调
 * @returns 一排格式化按钮，点击触发相应 Markdown 语法插入
 */
export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {/* 遍历 TOOLS 渲染各格式化按钮；点击时把前/后缀与占位文案交给 onInsert */}
      {TOOLS.map((tool) => {
        const label = messages.write[tool.labelKey];

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
                tool.placeholderKey ? messages.write[tool.placeholderKey] : undefined,
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
