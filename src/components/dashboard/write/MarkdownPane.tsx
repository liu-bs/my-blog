"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { texts } from "@/texts";
import { MarkdownToolbar } from "@/components/dashboard/write/MarkdownToolbar";
import { getMarkdownRenderer } from "@shared/markdown";

export type ViewMode = "split" | "edit" | "preview";

export const PREVIEW_DEBOUNCE_MS = 500;

export function MarkdownPane({
  content,
  onContentChange,
  error,
  viewMode,
}: {
  content: string;

  onContentChange: (value: string) => void;

  error?: string;

  viewMode: ViewMode;
}) {
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const contentRefMobile = useRef<HTMLTextAreaElement>(null);

  const contentValueRef = useRef(content);

  useEffect(() => {
    contentValueRef.current = content;
  });

  const [previewHtml, setPreviewHtml] = useState("");

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key === "b") {
      e.preventDefault();
      insertMarkdown("**", "**", texts.write.phBold);
    } else if (e.key === "i") {
      e.preventDefault();
      insertMarkdown("*", "*", texts.write.phItalic);
    } else if (e.key === "k") {
      e.preventDefault();
      insertMarkdown("[", "](https://)", texts.write.phLink);
    }
  };

  const emptyPreviewHtml = `<span class="text-muted">${texts.write.noContent}</span>`;

  const sharedTextareaProps = {
    name: "content",
    "aria-label": texts.write.contentPlaceholder,
    placeholder: texts.write.contentPlaceholder,
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
            className="post-content text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        </div>
      </div>

      <div className="lg:hidden">
        {viewMode === "preview" ? (
          <div
            className="post-content min-h-[60vh] rounded-xl border border-stroke-strong bg-card-bg p-6 text-(length:--type-base) leading-loose"
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
