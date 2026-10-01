/**
 * @file MarkdownPane.tsx
 * @description Markdown 编辑/预览双栏面板：桌面端左右分栏（编辑+实时预览），移动端按 viewMode 单栏切换；
 *              预览 HTML 500ms 防抖渲染（markdown 渲染器异步加载，失败回退展示原文）；
 *              支持工具栏插入与 Cmd/Ctrl+B/I/K 快捷键包裹选中文本，插入后恢复光标位置
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MarkdownToolbar } from "@/components/dashboard/write/MarkdownToolbar";
import { getMarkdownRenderer } from "@/lib/markdown";

/** 编辑/预览视图模式：split-桌面分栏，edit-仅编辑，preview-仅预览 */
export type ViewMode = "split" | "edit" | "preview";

/** 预览渲染防抖时长，单位ms */
export const PREVIEW_DEBOUNCE_MS = 500;

/**
 * MarkdownPane 编辑/预览面板
 * @param content 正文 Markdown
 * @param onContentChange 正文变更回调
 * @param error 正文校验错误文案
 * @param viewMode 视图模式
 */
export function MarkdownPane({
  content,
  onContentChange,
  error,
  viewMode,
}: {
  /** 正文 Markdown */
  content: string;

  /** 正文变更回调 */
  onContentChange: (value: string) => void;

  /** 正文校验错误文案 */
  error?: string;

  /** 视图模式 */
  viewMode: ViewMode;
}) {
  const t = useTranslations("write");

  /** 桌面端编辑区 textarea 引用 */
  const contentRef = useRef<HTMLTextAreaElement>(null);

  /** 移动端编辑区 textarea 引用 */
  const contentRefMobile = useRef<HTMLTextAreaElement>(null);

  /** 最新 content 引用（供插入逻辑绕过闭包旧值） */
  const contentValueRef = useRef(content);

  /** 每次渲染同步最新 content 到 ref */
  useEffect(() => {
    contentValueRef.current = content;
  });

  /** 防抖渲染出的预览 HTML */
  const [previewHtml, setPreviewHtml] = useState("");

  /** 预览渲染防抖定时器 */
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 预览渲染：非编辑模式且有内容时 500ms 防抖调用 Markdown 渲染器；
   * 内容为空或纯编辑模式清空预览；渲染异常回退为原文展示
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
   * 在光标/选区处插入 Markdown 标记：
   * 选中桌面或移动端中可见的 textarea，用 before/after 包裹选中文本（无选中则用占位符），
   * 变更后在下一帧恢复焦点并把光标移到插入内容之后
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

  /** 编辑区快捷键：Cmd/Ctrl+B 加粗、I 斜体、K 链接 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key === "b") {
      e.preventDefault();
      insertMarkdown("**", "**", t("phBold"));
    } else if (e.key === "i") {
      e.preventDefault();
      insertMarkdown("*", "*", t("phItalic"));
    } else if (e.key === "k") {
      e.preventDefault();
      insertMarkdown("[", "](https://)", t("phLink"));
    }
  };

  /** 预览区空内容占位 HTML */
  const emptyPreviewHtml = `<span class="text-muted">${t("noContent")}</span>`;

  /** 桌面/移动端 textarea 共享的受控属性与快捷键 */
  const sharedTextareaProps = {
    name: "content",
    "aria-label": t("contentPlaceholder"),
    placeholder: t("contentPlaceholder"),
    onKeyDown: handleKeyDown,
    value: content,
  };

  return (
    <>
      <div className="hidden grid-cols-2 gap-4 lg:grid">
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

        <div className="min-h-[60vh] overflow-y-auto rounded-xl border border-stroke-strong bg-card-bg p-6">
          <div
            className="article-content text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        </div>
      </div>

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

      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}
    </>
  );
}
