/**
 * @file MarkdownPane.tsx
 * @description 文章正文编辑器：宽屏固定左右分栏（左 Markdown 源码、右实时预览），窄屏按 viewMode 在「编辑 / 预览」间二选一。
 *              负责预览渲染（marked + highlight.js 动态加载）、工具栏插入语法、快捷键、以及插入后光标的定位。
 * @warning 预览渲染走 dangerouslySetInnerHTML，HTML 由 lib/markdown 的 renderer 产出，禁止在此拼接未处理的用户输入
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MarkdownToolbar } from "@/components/dashboard/write/MarkdownToolbar";
import { getMarkdownRenderer } from "@/lib/markdown";

/**
 * 正文区视图模式
 * @description `split` 为宽屏分栏；`edit` / `preview` 供窄屏在「仅编辑」「仅预览」间切换。
 *              由于宽屏分栏是常驻布局，该值实际只影响窄屏分支的渲染结果
 */
export type ViewMode = "split" | "edit" | "preview";

/** 预览渲染的防抖间隔，单位毫秒；避免每次按键都触发一次 Markdown 解析 */
export const PREVIEW_DEBOUNCE_MS = 500;

/**
 * MarkdownPane Markdown 编辑与预览面板
 * @description 内部同时挂载宽屏与窄屏两套 textarea（窄屏版仅用于移动端布局），
 *              插入语法时按「宽屏实例是否真实可见」自动挑选目标元素，从而复用同一份插入逻辑
 * @param props 组件入参，字段含义见下方内联类型注释
 * @param props.content 正文 Markdown 源码，由父级表单受控持有
 * @param props.onContentChange 正文变更回调（用户输入或工具栏插入都会触发）
 * @param props.error 提交阶段下发的校验错误文案
 * @param props.viewMode 窄屏下的展示模式，宽屏恒为分栏、忽略此值
 * @returns 宽屏分栏区、窄屏编辑/预览区，以及可选的错误提示
 */
export function MarkdownPane({
  content,
  onContentChange,
  error,
  viewMode,
}: {
  /** 正文 Markdown 源码 */
  content: string;
  /** 正文变更回调 */
  onContentChange: (value: string) => void;
  /** 提交阶段注入的错误文案 */
  error?: string;
  /** 窄屏视图模式 */
  viewMode: ViewMode;
}) {
  const t = useTranslations("write");

  /** 宽屏 textarea 引用，用于读取选区并在插入后恢复光标 */
  const contentRef = useRef<HTMLTextAreaElement>(null);

  /** 窄屏 textarea 引用，宽屏实例不可见时作为插入目标 */
  const contentRefMobile = useRef<HTMLTextAreaElement>(null);

  /** 正文最新值的镜像：插入语法需要在事件回调外同步读取最新内容，避免闭包拿到过期的 content */
  const contentValueRef = useRef(content);

  /** 每次渲染后同步正文镜像，保证插入时取到的是用户刚输入的文本 */
  useEffect(() => {
    contentValueRef.current = content;
  });

  /** 渲染后的预览 HTML；空串表示尚无内容，渲染空态占位 */
  const [previewHtml, setPreviewHtml] = useState("");

  /** 预览防抖计时器句柄，用于在内容再次变化或卸载时取消上一次待执行任务 */
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 正文或视图模式变化后防抖生成预览 HTML
   * @description 无内容或处于「仅编辑」时直接清空预览，省掉无用解析；
   *              渲染器由动态 import 提供（marked / highlight.js 体积大，不能进首屏包），
   *              因此这里以 Promise 链处理，并保留「渲染异常时降级为纯文本」的兜底
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
   * 在光标处包裹 / 插入 Markdown 语法
   * @description 有选中文本时以选区内容作为主体，否则填入 placeholder 供用户直接改写；
   *              由于受控 textarea 的值要等父级回传后才更新，光标定位必须放进下一帧（requestAnimationFrame），
   *              否则 setSelectionRange 会作用在旧值上而被浏览器重置。
   *              宽屏与窄屏共用同一 textarea 的 DOM 时以 offsetParent 判断哪个实例当前可见
   * @param before 插入到主体前的语法片段（如 `**`、`### `）
   * @param after 插入到主体后的闭合片段，如链接的 `](https://)`；不传表示无闭合
   * @param placeholder 无选中文本时填入的占位文案，来自 i18n
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
   * 快捷键处理：Ctrl / Cmd + B / I / K 分别对应加粗、斜体、链接
   * @description 只拦截上述组合，其余按键保持浏览器默认行为；命中后阻止默认，避免触发浏览器自带的加粗等命令
   * @param e textarea 键盘事件
   */
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

  /** 无正文时的预览占位 HTML，复用 article-content 的排版样式 */
  const emptyPreviewHtml = `<span class="text-muted">${t("noContent")}</span>`;

  /** 宽屏与窄屏 textarea 共用的属性，保证两套实例行为一致（含快捷键与受控值） */
  const sharedTextareaProps = {
    name: "content",
    "aria-label": t("contentPlaceholder"),
    placeholder: t("contentPlaceholder"),
    onKeyDown: handleKeyDown,
    value: content,
  };

  return (
    <>
      {/* 宽屏分栏：左侧编辑器（含工具栏）+ 右侧实时预览，lg 以下整体隐藏 */}
      <div className="hidden grid-cols-2 gap-4 lg:grid">
        {/* 编辑区容器 */}
        <div className="input-focus-within flex flex-col rounded-xl border border-stroke-strong bg-card-bg">
          {/* 语法工具栏 */}
          <div className="border-b border-stroke px-3 py-2">
            <MarkdownToolbar onInsert={insertMarkdown} />
          </div>
          {/* 宽屏源码输入框，id 固定为 content 供标签关联 */}
          <textarea
            {...sharedTextareaProps}
            ref={contentRef}
            id="content"
            onChange={(e) => onContentChange(e.target.value)}
            aria-invalid={!!error}
            className="min-h-[60vh] w-full flex-1 resize-none rounded-b-xl border-0 bg-transparent px-4 py-3 font-mono text-(length:--type-sm) leading-loose text-body placeholder:text-muted focus:outline-none"
          />
        </div>
        {/* 预览区：滚动由容器承担，内容由 dangerouslySetInnerHTML 注入 */}
        <div className="min-h-[60vh] overflow-y-auto rounded-xl border border-stroke-strong bg-card-bg p-6">
          <div
            className="article-content text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        </div>
      </div>

      {/* 窄屏分支：按 viewMode 在纯预览与纯编辑之间切换，宽屏下不渲染 */}
      <div className="lg:hidden">
        {viewMode === "preview" ? (
          /* 窄屏纯预览 */
          <div
            className="article-content min-h-[60vh] rounded-xl border border-stroke-strong bg-card-bg p-6 text-(length:--type-base) leading-loose"
            dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}
          />
        ) : (
          <>
            {/* 窄屏语法工具栏 */}
            <MarkdownToolbar onInsert={insertMarkdown} />
            {/* 窄屏源码输入框，id 与宽屏区分，避免同页重复 id */}
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

      {/* 提交阶段的字段级错误提示 */}
      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}
    </>
  );
}
