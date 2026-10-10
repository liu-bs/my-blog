/**
 * @file global-error.tsx
 * @description 全局错误兜底页，捕获根布局（layout.tsx）自身抛出的错误。
 * 因根布局可能已损坏，本文件必须自行渲染完整的 <html>/<body> 文档结构，
 * 且不加载 Tailwind，样式全部来自 errorPageShell 内联 CSS 变量。
 */
"use client";

import { useEffect } from "react";
import { messages } from "@/texts";
import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./errorPageShell";

/** 重新加载按钮的补充交互样式（hover/focus），与全站按钮规则保持一致 */
const RELOAD_CSS = `
  /* 主按钮的交互反馈：hover 只做明度变化，focus 走 2px 主色描边（与全站按钮规则一致） */
  .ge-reload:hover {
    opacity: 0.9;
  }
  .ge-reload:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
`;

/**
 * 全局错误兜底页组件
 * @param props error - 被捕获的错误（可含服务端 digest 标识）；retry - 重试渲染回调
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* 浏览器标签标题：本页自行渲染文档，不经过 layout 的 metadata */}
      <title>{`${messages.errors.errorTitle} · ${messages.meta.siteTitle}`}</title>
      <body>
        {/* 主题初始化脚本：根布局损坏时此处独立保证明暗主题不闪烁 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 自带错误页样式表（CSS 变量 + 按钮交互），不依赖 Tailwind */}
        <style>{ERROR_PAGE_CSS + RELOAD_CSS}</style>

        {/* 错误提示主体：标题 + 描述 + 重新加载按钮 */}
        <div style={errorShellStyle}>
          <h1 style={errorTitleStyle}>{messages.errors.errorTitle}</h1>
          <p style={errorDescStyle}>{messages.errors.errorDesc}</p>

          <button
            onClick={retry}
            className="ge-reload"
            style={{
              height: "40px",
              padding: "0 20px",
              borderRadius: "10px",
              border: "1px solid var(--color-stroke-strong)",
              background: "var(--color-accent)",
              color: "var(--color-page)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "opacity var(--duration-fast) var(--ease-smooth)",
            }}
          >
            {messages.errors.reload}
          </button>
        </div>
      </body>
    </html>
  );
}
