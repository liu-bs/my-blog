/**
 * @file markdown.service.ts
 * @description 服务端 markdown 渲染服务。marked + marked-highlight 渲染（按需注册
 * highlight.js 语言子集以控制包体），标题 slug 化注入 id 供 TOC 锚点跳转；
 * 输出经 sanitize-html 白名单净化：外链强制 target=_blank + rel=noopener noreferrer nofollow，
 * 白名单外的标签一律转义而非删除（disallowedTagsMode: escape）。
 */
import "server-only";

import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import shell from "highlight.js/lib/languages/shell";
import {
  MARKED_OPTIONS,
  highlightCode,
  registerHighlightLanguages,
  ALLOWED_TAGS,
} from "@/lib/markdown";
import sanitizeHtml from "sanitize-html";

/** 按需注册的 highlight.js 语言子集（键为语言名），避免引入全量语言包 */
const LANGUAGE_MODULES: Record<string, Parameters<typeof hljs.registerLanguage>[1]> = {
  javascript,

  typescript,

  python,

  bash,

  json,

  xml,

  css,

  sql,

  go,

  rust,

  java,

  yaml,

  markdown,

  shell,
};

registerHighlightLanguages(hljs, LANGUAGE_MODULES);

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight: (code, lang) => highlightCode(hljs, code, lang),
  }),
);

marked.setOptions(MARKED_OPTIONS);

/**
 * 将标题文本转为 TOC 锚点 slug：小写、空白转连字符、去除字母/数字外的字符、合并连续连字符
 * @param text 标题纯文本
 * @returns slug，纯符号标题返回空串
 */
function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 后处理钩子：为 h2/h3 注入 id（重复标题追加序号保证唯一），供目录锚点跳转
marked.use({
  hooks: {
    postprocess(html) {
      const seen = new Map<string, number>();
      return (html as string).replace(
        /<h([23])>([\s\S]*?)<\/h\1>/g,
        (whole, level: string, inner: string) => {
          const text = inner.replace(/<[^>]+>/g, "");
          let slug = slugifyHeading(text);
          if (!slug) return whole;
          const count = seen.get(slug) ?? 0;
          seen.set(slug, count + 1);
          if (count > 0) slug = `${slug}-${count}`;
          return `<h${level} id="${slug}">${inner}</h${level}>`;
        },
      );
    },
  },
});

/**
 * sanitize-html 白名单配置
 * 仅放行安全标签/属性/协议；a 标签外链强制新窗口打开并带 noopener noreferrer nofollow
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    "*": ["class", "id"],

    a: ["href", "title", "target", "rel"],

    img: ["src", "alt", "title", "width", "height"],

    code: ["class", "data-language"],
    pre: ["class", "data-language"],

    span: ["class"],

    input: ["type", "checked", "disabled"],

    th: ["align"],
    td: ["align"],
  },

  allowedSchemes: ["http", "https", "mailto"],

  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.href && !attribs.href.startsWith("#")) {
        return {
          tagName,
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        };
      }
      return { tagName, attribs };
    },
  },

  disallowedTagsMode: "escape",
};

/**
 * 将 markdown 渲染为安全的 HTML
 * 流程：marked 解析（含代码高亮与标题锚点注入）→ sanitize-html 白名单净化
 * @param markdown markdown 原文
 * @returns 净化后的 HTML，空入参返回空串
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";

  const rawHtml = marked.parse(markdown, { async: false }) as string;

  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
