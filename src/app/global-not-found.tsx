"use client";

import { messages } from "@/texts";
import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./errorPageShell";

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

export default function GlobalNotFound() {
  return (
    <html lang="zh-CN" suppressHydrationWarning>

      <title>{`${messages.errors.notFoundTitle} · ${messages.meta.siteTitle}`}</title>
      <body className="antialiased">

        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style>{ERROR_PAGE_CSS}</style>

        <div
          className="flex min-h-screen flex-col items-center justify-center text-center"
          style={errorShellStyle}
        >
          <h1 style={errorTitleStyle}>404</h1>
          <p style={errorDescStyle}>{messages.errors.notFoundDesc}</p>

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
