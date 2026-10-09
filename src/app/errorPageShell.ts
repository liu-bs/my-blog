/**
 * @file errorPageShell.ts
 * @description 错误/404 兜底页的共享样式常量集合。当根布局（layout.tsx）本身损坏时，
 * global-error.tsx / global-not-found.tsx 无法依赖 Tailwind 与全局 CSS，
 * 由此文件提供自包含的 CSS 变量（明暗双主题）、主题初始化脚本和内联样式对象。
 */

/** 错误页自带样式表：定义明暗两套 CSS 颜色变量与基础 body 样式（不加载 Tailwind） */
export const ERROR_PAGE_CSS = `
  :root {
    --color-page: oklch(0.982 0 0);          /* = --background */
    --color-body: oklch(0.145 0 0);          /* = --foreground */
    --color-muted: oklch(0.535 0 0);         /* = --muted-foreground */
    --color-heading: oklch(0.145 0 0);       /* = --foreground */
    --color-surface: oklch(0.965 0 0);       /* = --muted */
    --color-stroke: oklch(0.885 0 0);        /* = --border */
    --color-stroke-strong: oklch(0.84 0 0);  /* = --border-strong = --input */
    --color-accent: oklch(0.205 0 0);        /* = --primary */
    --color-state-error: oklch(0.53 0.16 27); /* = --destructive */
    --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text",
      "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei",
      "Noto Sans SC", "Source Han Sans SC", sans-serif;
  }
  .dark {
    --color-page: oklch(0.145 0 0);
    --color-body: oklch(0.985 0 0);
    --color-muted: oklch(0.708 0 0);
    --color-heading: oklch(0.985 0 0);
    --color-surface: oklch(0.269 0 0);
    --color-stroke: oklch(1 0 0 / 16%);
    --color-stroke-strong: oklch(1 0 0 / 24%);
    --color-accent: oklch(0.922 0 0);
    --color-state-error: oklch(0.72 0.13 25); /* = --destructive */
  }
  /* 错误页不加载 Tailwind，居中与配色全部自带，不依赖任何工具类 */
  body {
    margin: 0;
    background: var(--color-page);
    color: var(--color-body);
  }
`;

/** 主题初始化脚本（内联 <script> 用）：读 localStorage 判定暗色主题，异常时静默降级为亮色 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}`;

/** 错误页外层容器样式：全屏垂直水平居中排版 */
export const errorShellStyle = {
  fontFamily: "var(--font-sans)",
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  textAlign: "center",
} as const;

/** 错误页标题样式：响应式字号（clamp 38~48px），紧字距 */
export const errorTitleStyle = {
  color: "var(--color-heading)",
  fontSize: "clamp(38px, 8vw, 48px)",
  fontWeight: "bold",
  lineHeight: "1.1",
  marginBottom: "1rem",
  letterSpacing: "-0.02em",
} as const;

/** 错误页描述文本样式：弱化色、限宽 400px 保证可读行宽 */
export const errorDescStyle = {
  color: "var(--color-muted)",
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "2rem",
  maxWidth: "400px",
} as const;
