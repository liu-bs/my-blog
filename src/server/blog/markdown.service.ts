import "server-only";

/**
 * @file Markdown 渲染服务
 * @description 服务端把文章 Markdown 渲染为安全 HTML：marked + highlight.js 代码高亮，
 * 再经 sanitize-html 白名单净化（防 XSS）。仅按需注册 14 种高亮语言以控制包体；
 * 渲染产物为字符串，由 blog.service.getPost 注入 post.content，编辑器原文走 contentRaw。
 */

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
} from "@shared/markdown";
import sanitizeHtml from "sanitize-html";

/** highlight.js 按需注册的语言模块表：只打包博客常见语言，控制服务端体积 */
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

// 模块级单例：marked 实例与语言注册在进程内复用，避免每次渲染重建开销
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight: (code, lang) => highlightCode(hljs, code, lang),
  }),
);

marked.setOptions(MARKED_OPTIONS);

/** 标题转锚点 slug：保留 Unicode 字母/数字（中文标题可用），空格转连字符并压缩去边 */
function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 为 h2/h3 注入 id 以支持目录锚点跳转；同篇内重复 slug 追加 -1/-2 后缀保证唯一
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
 * XSS 净化白名单：标签/属性双白名单 + 协议白名单；
 * 站外链接统一加 target=_blank 与 rel=noopener noreferrer nofollow（安全 + 防 SEO 权重外流）；
 * img 额外允许 data: 协议以支持内联小图。禁用标签采取 escape 模式保留可见文本。
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
 * 将 Markdown 渲染为经净化的 HTML 字符串（同步解析）
 * @param markdown 原始 Markdown 文本
 * @returns 安全 HTML；空输入返回空串
 * @warning 仅供服务端渲染路径使用；净化在 marked 之后、入库前不落盘，存储的仍是 Markdown 原文
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";

  const rawHtml = marked.parse(markdown, { async: false }) as string;

  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
