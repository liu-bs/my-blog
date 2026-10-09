/**
 * @file global-not-found.tsx
 * @description 全局 404 兜底页（需 next.config.ts 开启 experimental.globalNotFound），
 * 捕获根布局层级未匹配的访问。与全局 error 页同理：自行渲染完整 <html>/<body>，
 * 样式仅依赖 errorPageShell 内联 CSS，不加载 Tailwind。
 */
"use client";

import { messages } from "@/texts";
import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./errorPageShell";

/** 操作链接的公共基础样式（尺寸、圆角、排版），配色由各链接自行覆盖 */
const linkBaseStyle = {
  height: "40px",
  padding: "0 20px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "500",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
} as const;

/**
 * 全局 404 兜底页组件
 */
export default function GlobalNotFound() {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        {/* 主题初始化脚本 + 错误页自带样式（不依赖 Tailwind） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style>{ERROR_PAGE_CSS}</style>

        {/* 404 提示主体：标题 + 描述 + 操作链接组 */}
        <div
          className="flex min-h-screen flex-col items-center justify-center text-center"
          style={errorShellStyle}
        >
          <h1 style={errorTitleStyle}>404</h1>
          <p style={errorDescStyle}>{messages.errors.notFoundDesc}</p>

          {/* 导航按钮：返回首页（主按钮样式）/ 浏览文章列表（描边样式） */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                ...linkBaseStyle,
                background: "var(--color-accent)",
                color: "var(--color-page)",
              }}
            >
              {messages.errors.goHome}
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/posts"
              style={{
                ...linkBaseStyle,
                border: "1px solid var(--color-stroke-strong)",
                color: "var(--color-body)",
              }}
            >
              {messages.errors.browsePosts}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
