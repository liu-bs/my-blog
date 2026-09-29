/**
 * @file global-not-found.tsx
 * @description 全局 404 页面，处理连 [locale] 段都无法匹配的路径。因在根 layout 之外渲染，需自带 <html>/<body>，且不依赖 next-intl
 */
"use client";

import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./errorPageShell";

/** 全局 404 的中英双语文案；不使用 next-intl，直接用字面量避免依赖未挂载的 Provider */
const copy = {
  zh: {
    title: "404",
    desc: "你访问的页面不存在或已被移动。",
    goHome: "返回首页",
    browsePosts: "浏览文章",
  },
  en: {
    title: "404",
    desc: "The page you are looking for does not exist or has been moved.",
    goHome: "Go home",
    browsePosts: "Browse posts",
  },
} as const;

/** 两个操作链接共用的基础样式，各自再覆盖背景 / 描边 */
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
 * GlobalNotFound 全局 404 页
 * @description 根 layout 之外渲染的兜底页，必须自带 <html>/<body>；通过路径前缀判语言，链接指向对应语言前缀的首页与文章列表
 */
export default function GlobalNotFound() {
  /** 全局 404 读不到语言上下文，用 URL 前缀判断；默认中文 */
  const lang =
    typeof window !== "undefined" && window.location.pathname.startsWith("/en") ? "en" : "zh";
  const t = copy[lang];

  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style>{ERROR_PAGE_CSS}</style>

        <div
          className="flex min-h-screen flex-col items-center justify-center text-center"
          style={errorShellStyle}
        >
          <h1 style={errorTitleStyle}>{t.title}</h1>
          <p style={errorDescStyle}>{t.desc}</p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
            <a
              href={lang === "en" ? "/en" : "/zh"}
              style={{
                ...linkBaseStyle,
                background: "var(--color-accent)",
                color: "var(--color-page)",
              }}
            >
              {t.goHome}
            </a>
            <a
              href={lang === "en" ? "/en/posts" : "/zh/posts"}
              style={{
                ...linkBaseStyle,
                border: "1px solid var(--color-stroke-strong)",
                color: "var(--color-body)",
              }}
            >
              {t.browsePosts}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
