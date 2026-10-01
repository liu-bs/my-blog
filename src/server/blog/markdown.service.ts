/**
 * @file markdown.service.ts
 * @description 服务端 Markdown 渲染管线：marked 解析 → highlight.js 代码高亮 → sanitize-html 白名单清洗
 * @warning 仅在服务端可用（依赖 server-only）。文章正文统一在服务端渲染成 HTML 再下发：
 * 一方面避免把 markdown 解析器与全部高亮语言打进浏览器包，另一方面让 XSS 清洗在受信任的环境完成
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

/** highlight.js 语言模块表：逐个 import 而非全量引入，避免把上百种语言打进产物；未在此登记的代码块由 highlightCode 自动识别兜底 */
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

// 启动时一次性把所有语言（含别名）注册进 hljs 实例，渲染阶段无需重复注册
registerHighlightLanguages(hljs, LANGUAGE_MODULES);

/**
 * marked 全局单例
 * @description 通过 marked-highlight 扩展接管 ``` 代码块的渲染；langPrefix 生成 `hljs language-<lang>` 的 class，
 * 与前端 highlight.js 主题样式约定保持一致
 */
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight: (code, lang) => highlightCode(hljs, code, lang),
  }),
);

marked.setOptions(MARKED_OPTIONS);

/**
 * 把标题文本转成 URL 安全的锚点 slug
 * @description 保留字母/数字（含中日韩文字）/连字符/下划线，其余标点剔除；空白折叠为单个 `-`
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

/**
 * 为 H2/H3 生成确定性 id
 * @description 作者手写的 `[章节](#锚点)` 内链与分享出去的深链都依赖标题 id；此前 id 只由
 * 客户端 PostToc 运行时按序号补，深链在服务端产物里永远落空。这里在渲染管道内补 id，
 * 同名标题按出现顺序追加 `-1`、`-2` 后缀；清洗配置已放行 id 属性，无需再动白名单
 */
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
 * sanitize-html 清洗配置：用户正文渲染出的 HTML 一律先过这里，再交给前端
 * @description 采用白名单策略——只放行 ALLOWED_TAGS 中的标签和显式列出的属性，未匹配的一律处理，
 * 从根本上阻断脚本注入与事件属性等 XSS 载体
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // 标签白名单完全复用共享的 ALLOWED_TAGS，保证与服务端其它 Markdown 处理逻辑一致
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    // 所有标签放行 class（hljs 高亮与样式）与 id（锚点）
    "*": ["class", "id"],
    // 链接额外允许跳转与安全属性
    a: ["href", "title", "target", "rel"],
    // 图片允许尺寸属性，便于排版
    img: ["src", "alt", "title", "width", "height"],
    // 代码块保留语言标识，供前端高亮或复制按钮识别
    code: ["class", "data-language"],
    pre: ["class", "data-language"],
    // span 仅用于 hljs 的 token class
    span: ["class"],
    // 任务列表复选框（GFM）只读呈现
    input: ["type", "checked", "disabled"],
    // 表格单元格对齐
    th: ["align"],
    td: ["align"],
  },
  // 链接协议白名单，杜绝 javascript: 等伪协议
  allowedSchemes: ["http", "https", "mailto"],
  // 图片额外允许 data:，以支持内嵌图片
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  transformTags: {
    // 站外链接统一新开标签页，并补 rel 防止 tabnabbing 与 SEO 权重流失；页内锚点（# 开头）保持原样
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
  // escape：未在白名单内的标签转义为纯文本展示而非直接删除，既保留用户原始内容又不会被执行
  disallowedTagsMode: "escape",
};

/**
 * 将 Markdown 源文渲染为可安全插入页面的 HTML
 * @description 渲染顺序为「先解析、后清洗」：若顺序颠倒，sanitize 会误伤未生成的 HTML 结构。
 * 解析同步完成（async: false）以便在 Server Component / Service 层直接同步返回字符串
 * @param markdown Markdown 原文，通常是文章 content 字段
 * @returns 已通过白名单清洗的 HTML 字符串；入参为空时返回空串
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";

  const rawHtml = marked.parse(markdown, { async: false }) as string;

  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
