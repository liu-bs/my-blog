/**
 * @file errorPageShell.ts
 * @description 错误/404 兜底页共享资源：内联 CSS 变量主题、防闪烁主题初始化脚本与标题/描述样式对象。
 *              兜底页不加载 Tailwind 与全局样式，所有视觉资源必须在此自包含
 */

/**
 * 错误页内联样式表：以 CSS 变量复刻全站明暗两套配色（oklch 值与 globals.css 保持一致）
 */
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

/**
 * 主题防闪烁脚本：首帧前读取 localStorage 主题或跟随系统深色偏好，给 html 挂上 dark 类
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}`;

/** 错误页外层容器样式：全屏居中布局 */
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

/** 错误页主标题样式（404/错误码大字） */
export const errorTitleStyle = {
  color: "var(--color-heading)",
  fontSize: "clamp(38px, 8vw, 48px)",
  fontWeight: "bold",
  lineHeight: "1.1",
  marginBottom: "1rem",
  letterSpacing: "-0.02em",
} as const;

/** 错误页描述文案样式 */
export const errorDescStyle = {
  color: "var(--color-muted)",
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "2rem",
  maxWidth: "400px",
} as const;
