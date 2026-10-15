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

export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^\>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

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
