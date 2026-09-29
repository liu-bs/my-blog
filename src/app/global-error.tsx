/**
 * @file global-error.tsx
 * @description 全局错误边界。它会替换根 layout（自身必须渲染 <html>/<body>），捕获包括根 layout 在内的渲染错误；不依赖 next-intl，靠 URL 前缀判断语言
 */
"use client";

import { useEffect } from "react";
import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./errorPageShell";

/** 「重新加载」按钮的交互样式，追加到共享错误页 CSS 之后 */
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
 * GlobalError 全局错误页
 * @description 根 layout 也崩溃时的最后兜底：必须自带 <html>/<body>，内联注入主题脚本与错误页样式，并提供 reset 重新渲染
 * @param error 触发的错误对象，Next.js 会附带 digest 作为服务端错误的可追踪标识
 * @param reset 由 Next.js 注入的重试函数，点击「重新加载」时调用以重新渲染出错的分支
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /** 错误上报到控制台，便于线上排查（此处无 logger 依赖，因整棵样式与 Provider 可能已失效） */
  useEffect(() => {
    console.error(error);
  }, [error]);

  /** 全局错误页无法读取 next-intl 上下文，用路径前缀粗略判断语言 */
  const isEn = typeof window !== "undefined" && window.location.pathname.startsWith("/en");

  /** 按语言选择的文案集合 */
  const copy = isEn
    ? {
        title: "Something went wrong",
        desc: "A critical error occurred. Try reloading — if the problem persists, please try again later.",
        reload: "Reload",
      }
    : {
        title: "出错了",
        desc: "应用发生了严重错误。请尝试重新加载，如果问题持续出现请稍后再试。",
        reload: "重新加载",
      };

  return (
    <html lang={isEn ? "en" : "zh-CN"} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style>{ERROR_PAGE_CSS + RELOAD_CSS}</style>

        <div
          className="flex min-h-screen flex-col items-center justify-center text-center"
          style={errorShellStyle}
        >
          <h1 style={errorTitleStyle}>{copy.title}</h1>
          <p style={errorDescStyle}>{copy.desc}</p>

          <button
            onClick={reset}
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
            {copy.reload}
          </button>
        </div>
      </body>
    </html>
  );
}
