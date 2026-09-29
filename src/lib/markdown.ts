/**
 * @file markdown.ts
 * @description 客户端 Markdown 相关职责：正文纯文本抽取（摘要、字数、阅读时长）与带语法高亮的 Markdown 渲染器。
 * 渲染器依赖 marked 与 highlight.js，体积较大，故全部改为按需动态加载并缓存，避免进入首屏包
 */

/** 文章正文富文本白名单标签：服务端清洗与客户端渲染共用的允许标签集合 */
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
 * 剥离 HTML 标签得到纯文本
 * @description 仅做标签剔除与空白压缩，属于「取近似纯文本」用途（摘要、字数统计），不保证语义完整
 * @param s 源字符串，允许为空
 * @returns 去标签并压缩空格后的文本
 */
export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^\>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 剥离 Markdown 语法得到纯文本
 * @description 按「块级 → 行内」顺序逐类正则替换，用 Markdown 语法本身作为剥离依据而非严格解析器，
 * 因此对畸形语法可能残留少量符号，但足以支撑摘要与统计场景
 * @param s Markdown 源文本
 * @returns 去除代码块、图片/链接、标题、引用、分隔线、列表符号与强调标记后的纯文本
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
 * 估算阅读时长（分钟）
 * @description 按中英文分别计速：中日韩字符按 400 字/分钟，英文单词按 200 词/分钟，两者取较大值作为结果，
 * 使中英混排内容不会被低估；空文本与极短文本统一按下限 1 分钟
 * @param content 文章正文（可含 HTML 标签）
 * @returns 阅读分钟数，最小为 1
 */
export function estimateReadingTime(content: string): number {
  const text = stripHtml(content);
  if (!text) return 1;

  // 统计 CJK 字符数（含中日韩标点与全角符号）
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g) || [])
    .length;

  // 把 CJK 字符替换为空格后再按空白切分，得到英文单词数
  const enWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const minutes = Math.max(cjkCount / 400, enWords / 200);
  return Math.max(1, Math.ceil(minutes));
}

/** 代码语言到 highlight.js 需额外注册的别名映射；值为空表示该语言无需别名 */
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

/**
 * marked 的解析选项
 * @description gfm 启用 GitHub 风格扩展（表格、任务列表、删除线等）；breaks 让单个换行也渲染为 <br>，
 * 更符合博客作者在编辑器里的直观预期
 */
export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

/**
 * 对代码块做语法高亮
 * @description 策略：指定语言且该语言已注册时精确高亮；否则退化为 highlightAuto 自动识别；
 * 任一步失败都回退为原文，保证代码内容不因高亮异常而丢失
 * @param hljs highlight.js 核心实例（结构对参数做了最小化约束，便于测试替身）
 * @param code 待高亮的源代码
 * @param lang 代码块标注的语言，未标注时为空
 * @returns 带高亮标签的 HTML（或原始代码）
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
 * 批量注册需要支持的语言及其别名
 * @description 只注册 modules 中实际存在的语言，缺失的（未被打包的）静默跳过，避免启动即报错
 * @param hljs highlight.js 核心实例
 * @param modules 语言名到语言包的映射
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
 * Markdown 渲染函数签名
 */
export type MarkdownRenderer = (content: string) => Promise<string>;

/** 渲染器的单例 Promise 缓存，保证整个应用只在首次渲染时才加载并初始化一次 marked/hljs */
let markdownRendererPromise: Promise<MarkdownRenderer> | null = null;

/**
 * 获取（惰性初始化并缓存的）Markdown 渲染器
 * @description 并行动态导入 marked、highlight.js 核心与所需语言包，注册语言并覆写 code 渲染逻辑：
 * 输出 `<pre><code class="hljs language-xxx">` 结构以配合高亮样式；未标注语言时标记为 plaintext。
 * 由于是异步导入，首屏不会同步阻塞；后续调用直接复用同一个 Promise
 * @returns 渲染函数：接收 Markdown 源文本，返回 HTML 字符串；解析本身是同步的（async: false）只是被包装为 Promise
 * @warning 返回的 HTML 假定调用方已做必要的可信度处理，请勿直接渲染不可信来源的内容
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

    /** 本次打包实际提供的语言包集合 */
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

    /** 覆写 code 渲染：先去掉 marked 保留的末尾换行，再高亮并套上 hljs 的类名 */
    renderer.code = ({ text, lang }) => {
      const code = text.replace(/\n$/, "");
      try {
        const highlighted = highlightCode(hljs, code, lang);
        return `<pre><code class="hljs language-${lang || "plaintext"}">${highlighted}</code></pre>`;
      } catch {
        // 高亮异常时退化为无高亮的代码块
        return `<pre><code class="hljs">${code}</code></pre>`;
      }
    };

    marked.setOptions(MARKED_OPTIONS);

    marked.use({ renderer });

    return async (content: string) => {
      // async: false 表示同步解析，外层 Promise 仅为统一异步接口
      return marked.parse(content, { async: false }) as string;
    };
  })();
  return markdownRendererPromise;
}
