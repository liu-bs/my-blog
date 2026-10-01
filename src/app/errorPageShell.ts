/**
 * @file errorPageShell.ts
 * @description 错误 / 404 兜底页面的共享外壳样式与初始化脚本。这些页面在 root layout 之外渲染（甚至不加载 Tailwind），因此把配色、字体、内联样式抽到这里统一复用
 */

/**
 * 兜底页面内联 CSS
 * @description 不依赖 Tailwind 与全局 CSS 变量文件，用固定的 oklch 值复刻主题色，并对 .dark 给出暗色覆盖；错误页可能是全站样式崩坏时的最后防线，必须自带完整配色
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
 * 主题初始化脚本（内联执行）
 * @description 读取 localStorage 中的 theme：仅当显式选了 light 才强制亮色；
 *   值为 "system"（next-themes 默认存储值）或未设置时回退系统偏好，命中暗色则给 <html> 挂上 .dark。
 *   在 error / not-found 页里兜底，同时被根布局头部注入以在流式渲染下阻止主题闪烁
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}`;

/**
 * 页面外层容器的内联样式：撑满视口并让内容水平垂直居中
 * @description 用 as const 固定字面量类型，便于直接用作 React style 值
 */
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

/**
 * 标题内联样式：随视口缩放的字号（clamp）与紧凑行高、负字距
 */
export const errorTitleStyle = {
  color: "var(--color-heading)",
  fontSize: "clamp(38px, 8vw, 48px)",
  fontWeight: "bold",
  lineHeight: "1.1",
  marginBottom: "1rem",
  letterSpacing: "-0.02em",
} as const;

/**
 * 描述文案内联样式：次级文字色，限制最大宽度以保证断行可读性
 */
export const errorDescStyle = {
  color: "var(--color-muted)",
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "2rem",
  maxWidth: "400px",
} as const;
