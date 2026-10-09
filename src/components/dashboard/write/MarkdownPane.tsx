/**
 * @file MarkdownPane.tsx
 * @description Markdown 编辑面板：桌面端「编辑器+实时预览」双栏，移动端按 viewMode 切换单栏；负责工具栏语法插入、快捷键与去抖渲染预览 HTML
 * @usage 客户端组件，受控于 content/viewMode；预览渲染依赖异步 getMarkdownRenderer，失败时回退纯文本。导出 ViewMode 与 PREVIEW_DEBOUNCE_MS 供其他写作组件复用
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messages } from "@/texts";
import { MarkdownToolbar } from "@/components/dashboard/write/MarkdownToolbar";
import { getMarkdownRenderer } from "@shared/markdown";

/** 编辑区视图模式：双栏 / 仅编辑 / 仅预览 */
export type ViewMode = "split" | "edit" | "preview";

/** 预览渲染的去抖间隔（毫秒），也被 CoverField 复用 */
export const PREVIEW_DEBOUNCE_MS = 500;

/**
 * Markdown 编辑面板
 * @param props.content 当前正文内容
 * @param props.onContentChange 正文变更回调
 * @param props.error 正文字段错误信息
 * @param props.viewMode 当前视图模式
 * @returns 桌面双栏与移动单栏两套编辑器/预览结构
 */
export function MarkdownPane({
  content,
  onContentChange,
  error,
  viewMode,
}: {
  /** 当前正文内容 */
  content: string;

  /** 正文变更回调 */
  onContentChange: (value: string) => void;

  /** 正文字段错误信息 */
  error?: string;

  /** 当前视图模式 */
  viewMode: ViewMode;
}) {
  /** 桌面编辑器 textarea 引用 */
  const contentRef = useRef<HTMLTextAreaElement>(null);

  /** 移动端编辑器 textarea 引用 */
  const contentRefMobile = useRef<HTMLTextAreaElement>(null);

  /** 持久化最新 content，供闭包中的 insertMarkdown 读取当前值 */
  const contentValueRef = useRef(content);

  /** 每次渲染同步 contentValueRef 到最新正文 */
  useEffect(() => {
    contentValueRef.current = content;
  });

  /** 渲染后的预览 HTML 字符串 */
  const [previewHtml, setPreviewHtml] = useState("");

  /** 预览去抖定时器句柄 */
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * content/viewMode 变更时去抖渲染预览；编辑态或空内容直接清空预览，渲染失败回退为原始文本
   */
  useEffect(() => {
    if (!content || viewMode === "edit") {
      setPreviewHtml("");
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      getMarkdownRenderer()
        .then((render) => render(content))
        .then((html) => setPreviewHtml(html))

        .catch(() => setPreviewHtml(content));
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [content, viewMode]);

  /**
   * 在光标处插入 Markdown 语法：优先取当前可见 textarea，包裹选区或用占位文本，插入后还原焦点与光标位置
   * @param before 前缀标记
   * @param after 后缀标记
   * @param placeholder 无选区时的占位文本
   */
  const insertMarkdown = useCallback(
    (before: string, after?: string, placeholder?: string) => {
      const textarea =
        contentRef.current && contentRef.current.offsetParent !== null
          ? contentRef.current
          : contentRefMobile.current;
      if (!textarea) return;
      const currentContent = contentValueRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = currentContent.substring(start, end);
      const insertText = selectedText || placeholder || "";
      const newText =
        currentContent.substring(0, start) +
        before +
        insertText +
        (after || "") +
        currentContent.substring(end);
      onContentChange(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + before.length + insertText.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [onContentChange],
  );

  /**
   * 编辑器快捷键：Cmd/Ctrl+B/I/K 分别插入加粗、斜体、链接语法
   * @param e textarea 键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key === "b") {
      e.preventDefault();
      insertMarkdown("**", "**", messages.write.phBold);
    } else if (e.key === "i") {
      e.preventDefault();
      insertMarkdown("*", "*", messages.write.phItalic);
    } else if (e.key === "k") {
      e.preventDefault();
      insertMarkdown("[", "](https://)", messages.write.phLink);
    }
  };

  /** 空内容时的预览占位 HTML */
  const emptyPreviewHtml = `<span class="text-muted">${messages.write.noContent}</span>`;

  /** 桌面/移动两套 textarea 共享的属性 */
  const sharedTextareaProps = {
    name: "content",
    "aria-label": messages.write.contentPlaceholder,
    placeholder: messages.write.contentPlaceholder,
    onKeyDown: handleKeyDown,
    value: content,
  };

  return (
    <>
      {/* 桌面双栏：左编辑器右预览 */}
      <div className="hidden grid-cols-2 gap-4 lg:grid">
        {/* 编辑栏（工具栏 + textarea） */}
        <div className="input-focus-within flex flex-col rounded-xl border border-stroke-strong bg-card-bg">
          <div className="border-b border-stroke px-3 py-2">
            <MarkdownToolbar onInsert={insertMarkdown} />
          </div>

          <textarea
            {...sharedTextareaProps}
            ref={contentRef}
            id="content"
            onChange={(e) => onContentChange(e.target.value)}
            aria-invalid={!!error}
            className="min-h-[60vh] w-full flex-1 resize-none rounded-b-xl border-0 bg-transparent px-4 py-3 font-mono text-(length:--type-sm) leading-loose text-body placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* 预览栏（渲染后的 HTML， dangerouslySetInnerHTML 注入已渲染内容） */}
        <div className="min-h-[60vh] overflow-y-auto rounded-xl border border-stroke-strong bg-card-bg p-6">
          <div
            className="article-content text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        </div>
      </div>

      {/* 移动端单栏：预览态展示 HTML，否则展示工具栏 + textarea */}
      <div className="lg:hidden">
        {viewMode === "preview" ? (
          <div
            className="article-content min-h-[60vh] rounded-xl border border-stroke-strong bg-card-bg p-6 text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        ) : (
          <>
            <MarkdownToolbar onInsert={insertMarkdown} />

            <textarea
              {...sharedTextareaProps}
              ref={contentRefMobile}
              id="content-mobile"
              onChange={(e) => onContentChange(e.target.value)}
              aria-invalid={!!error}
              rows={20}
              className="input-focus mt-2 textarea-field min-h-100 font-mono text-(length:--type-sm) leading-loose"
            />
          </>
        )}
      </div>

      {/* 正文字段错误提示 */}
      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}
    </>
  );
}
