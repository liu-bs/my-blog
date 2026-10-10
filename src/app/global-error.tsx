"use client";

import { useEffect } from "react";
import errors from "@/texts/errors";
import meta from "@/texts/meta";
import {
  ERROR_PAGE_CSS,
  THEME_INIT_SCRIPT,
  errorShellStyle,
  errorTitleStyle,
  errorDescStyle,
} from "./error-page-shell";

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
      <title>{`${errors.errorTitle} · ${meta.siteTitle}`}</title>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        <style>{ERROR_PAGE_CSS + RELOAD_CSS}</style>

        <div style={errorShellStyle}>
          <h1 style={errorTitleStyle}>{errors.errorTitle}</h1>
          <p style={errorDescStyle}>{errors.errorDesc}</p>

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
            {errors.reload}
          </button>
        </div>
      </body>
    </html>
  );
}
