/**
 * @file markdown.ts
 * @description Markdown/HTML 公共处理工具：净化白名单标签、纯文本提取（摘要/RSS/SEO）、
 * 阅读时长估算、highlight.js 高亮与 marked 渲染器单例。
 * 消费方：server/blog/markdown.service.ts（sanitize 配置）、blog.service（摘要截取）、
 * app/rss 与 posts/[id]（标题描述清洗）、dashboard/write/MarkdownPane（编辑器预览渲染）。
 */

/** sanitize-html 允许保留的标签白名单，markdown.service.ts 净化渲染结果时使用 */
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
 * 去除 HTML 标签并将连续空白压缩为单个空格（用于摘要/RSS 描述展示）
 * @param s HTML 字符串
 * @returns 纯文本；入参为空时返回空串
 */
export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^\>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 移除 Markdown 语法标记，得到纯文本（标题清洗、摘要自动截取前的预处理）
 * @param s Markdown 源文本
 * @returns 去掉代码块、行内样式、链接、标题、列表、引用等标记后的文本；入参为空时返回空串
 * @warning 纯正则近似实现，嵌套语法等复杂场景不保证完全准确，用于展示层可接受
 */
export function stripMarkdown(s: string): string {
  if (!s) return "";
  return s

    .replace(/```[\s\S]*?```/g, "")

    .replace(/`([^`]+)`/g, "$1")

    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")

    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")

    .replace(/^#{1,6}\s+/gm, "")

    .replace(/^>\s+/gm, "")

    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "")

    .replace(/^[\s]*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, "")

    .replace(/^[\s]*\d+[.)]\s+/gm, "")

    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")

    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1$2")

    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

/**
 * 估算文章阅读时长
 * @param content HTML 或 Markdown 正文
 * @returns 预计阅读分钟数，至少 1；中文按约 400 字/分钟、英文按约 200 词/分钟，取两者较大值
 */
export function estimateReadingTime(content: string): number {
  const text = stripHtml(content);
  if (!text) return 1;

  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g) || [])
    .length;

  const enWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const minutes = Math.max(cjkCount / 400, enWords / 200);
  return Math.max(1, Math.ceil(minutes));
}

/** highlight.js 语言主名到别名列表的映射，registerHighlightLanguages 按此注册 */
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

/** marked 解析选项：启用 GFM 扩展语法、换行符转 <br> */
export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

/**
 * 对单段代码做语法高亮
 * @param hljs highlight.js 实例（以最小接口注入，避免本模块硬依赖）
 * @param code 代码原文
 * @param lang 围栏代码块声明的语言，可为空
 * @returns 高亮后的 HTML；语言未知或高亮失败时回退自动识别，再失败则原样返回
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
 * 将语言模块批量注册到 highlight.js（含别名，如 ts -> typescript）
 * @param hljs highlight.js 实例
 * @param modules 语言主名到动态导入模块的映射，缺失的语言直接跳过
 * @returns 无
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

/** Markdown 渲染函数：输入源文本，返回渲染后的 HTML */
type MarkdownRenderer = (content: string) => Promise<string>;

/** 渲染器初始化 Promise 缓存，保证 marked/hljs 只动态加载并配置一次 */
let markdownRendererPromise: Promise<MarkdownRenderer> | null = null;

/**
 * 获取配置好代码高亮的 Markdown 渲染器（懒加载单例）
 * @returns 渲染函数 Promise；首次调用时动态 import marked 与 highlight.js 及常用语言包
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

    const renderer = new marked.Renderer();

    renderer.code = ({ text, lang }) => {
      const code = text.replace(/\n$/, "");
      try {
        const highlighted = highlightCode(hljs, code, lang);
        return `<pre><code class="hljs language-${lang || "plaintext"}">${highlighted}</code></pre>`;
      } catch {
        return `<pre><code class="hljs">${code}</code></pre>`;
      }
    };

    marked.setOptions(MARKED_OPTIONS);

    marked.use({ renderer });

    return async (content: string) => {
      return marked.parse(content, { async: false }) as string;
    };
  })();
  return markdownRendererPromise;
}
