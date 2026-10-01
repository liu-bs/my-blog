/**
 * @file markdown.ts
 * @description Markdown/HTML 纯函数与客户端渲染辅助：摘要提取（stripMarkdown/stripHtml）、阅读时长估算、highlight.js 代码高亮注册；getMarkdownRenderer 懒加载 marked 渲染器供客户端使用，服务端渲染走 markdown.service 管线
 */

/**
 * 允许保留的 HTML 标签白名单
 */
export const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "a",
  "img",
  "blockquote",
  "q",
  "cite",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  "div",
  "span",
  "figure",
  "figcaption",
  "details",
  "summary",
  "abbr",
  "address",
  "time",
  "small",
  "input",
] as const;

/**
 * 去除 HTML 标签并压缩空白
 * @param s 含 HTML 的字符串
 * @returns 纯文本
 */
export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^\>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 去除 Markdown 语法标记（代码块/链接/标题/列表/强调等），保留文字内容
 * @param s Markdown 字符串
 * @returns 纯文本
 */
export function stripMarkdown(s: string): string {
  if (!s) return "";
  return (
    s

      // 围栏代码块整段移除
      .replace(/```[\s\S]*?```/g, "")

      // 行内代码仅保留内容
      .replace(/`([^`]+)`/g, "$1")

      // 图片仅保留 alt 文本
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")

      // 链接仅保留文本
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")

      // 标题标记
      .replace(/^#{1,6}\s+/gm, "")

      // 引用标记
      .replace(/^>\s+/gm, "")

      // 分隔线
      .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "")

      // 无序列表标记（含任务列表勾选框）
      .replace(/^[\s]*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, "")

      // 有序列表标记
      .replace(/^[\s]*\d+[.)]\s+/gm, "")

      // 粗体
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")

      // 斜体
      .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
      .replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1$2")

      // 删除线
      .replace(/~~([^~]+)~~/g, "$1")
      .trim()
  );
}

/**
 * 估算阅读时长：中文按 400 字/分钟，英文按 200 词/分钟
 * @param content Markdown 或 HTML 内容
 * @returns 阅读分钟数，最少 1 分钟
 */
export function estimateReadingTime(content: string): number {
  const text = stripHtml(content);
  if (!text) return 1;

  // CJK 字符（含中文标点/全角字符）按字计数
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g) || [])
    .length;

  // 其余按英文单词计数
  const enWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const minutes = Math.max(cjkCount / 400, enWords / 200);
  return Math.max(1, Math.ceil(minutes));
}

/**
 * 语言别名表：注册主语言时同步注册别名（如 ts -> typescript）
 */
const HIGHLIGHT_ALIASES: Record<string, string[]> = {
  javascript: ["js"],
  typescript: ["ts"],
  python: ["py"],
  bash: ["sh"],
  xml: ["html"],
  css: [],
  json: [],
  sql: [],
  go: [],
  rust: ["rs"],
  java: [],
  yaml: ["yml"],
  markdown: ["md"],
  shell: ["shell-session", "console"],
};

/** marked 解析配置：启用 GFM 扩展与换行转 <br> */
export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

/**
 * 代码高亮，未知语言回退自动检测，失败返回原文
 * @param hljs highlight.js 实例（结构化入参，避免直接依赖具体类型）
 * @param code 代码文本
 * @param lang 语言标识
 * @returns 高亮后的 HTML
 */
export function highlightCode(
  hljs: {
    getLanguage(name: string): unknown;
    highlight(code: string, opts: { language: string }): { value: string };
    highlightAuto(code: string): { value: string };
  },
  code: string,
  lang?: string,
): string {
  const language = lang && hljs.getLanguage(lang) ? lang : "";
  if (language) {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {}
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return code;
  }
}

/**
 * 批量注册语言模块及其别名
 * @param hljs highlight.js 实例
 * @param modules 语言名到语言模块的映射
 */
export function registerHighlightLanguages<M>(
  hljs: { registerLanguage(name: string, module: M): unknown },
  modules: Record<string, M>,
): void {
  for (const [lang, aliases] of Object.entries(HIGHLIGHT_ALIASES)) {
    const mod = modules[lang];
    if (!mod) continue;
    hljs.registerLanguage(lang, mod);
    for (const alias of aliases) hljs.registerLanguage(alias, mod);
  }
}

/**
 * Markdown 渲染函数类型
 */
export type MarkdownRenderer = (content: string) => Promise<string>;

/** 渲染器单例 Promise，避免重复加载语言包 */
let markdownRendererPromise: Promise<MarkdownRenderer> | null = null;

/**
 * 懒加载并初始化 marked + highlight.js 客户端渲染器（单例 Promise，避免重复加载）
 * @returns Markdown 渲染函数
 */
export function getMarkdownRenderer(): Promise<MarkdownRenderer> {
  if (markdownRendererPromise) return markdownRendererPromise;
  markdownRendererPromise = (async () => {
    const [
      { marked },
      { default: hljs },
      { default: javascript },
      { default: typescript },
      { default: xml },
      { default: css },
      { default: json },
      { default: bash },
      { default: python },
      { default: sql },
    ] = await Promise.all([
      import("marked"),
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/javascript"),
      import("highlight.js/lib/languages/typescript"),
      import("highlight.js/lib/languages/xml"),
      import("highlight.js/lib/languages/css"),
      import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/bash"),
      import("highlight.js/lib/languages/python"),
      import("highlight.js/lib/languages/sql"),
    ]);

    const LANGUAGE_MODULES: Record<string, Parameters<typeof hljs.registerLanguage>[1]> = {
      javascript,
      typescript,
      xml,
      css,
      json,
      bash,
      python,
      sql,
    };

    registerHighlightLanguages(hljs, LANGUAGE_MODULES);

    // 自定义代码块渲染：包上 hljs 类名与 pre/code 结构
    const renderer = new marked.Renderer();

    renderer.code = ({ text, lang }) => {
      const code = text.replace(/\n$/, "");
      try {
        const highlighted = highlightCode(hljs, code, lang);
        return `<pre><code class="hljs language-${lang || "plaintext"}">${highlighted}</code></pre>`;
      } catch {
        // 高亮失败时保留原文本
        return `<pre><code class="hljs">${code}</code></pre>`;
      }
    };

    marked.setOptions(MARKED_OPTIONS);

    marked.use({ renderer });

    return async (content: string) => {
      // marked 同步解析，返回 HTML 字符串
      return marked.parse(content, { async: false }) as string;
    };
  })();
  return markdownRendererPromise;
}
