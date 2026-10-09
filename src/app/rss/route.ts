/**
 * @file route.ts (GET /rss)
 * @description RSS 2.0 订阅源路由：手工拼接 XML 输出最新 20 篇文章，供阅读器订阅
 * （/rss.xml 经 next.config.ts 永久重定向到此路径）。无鉴权、无限流。
 * 响应：Content-Type 为 application/rss+xml，缓存 1 小时（public, max-age=3600, s-maxage=3600）。
 */
import { listPostsServer, withDbRetry } from "@server/blog/blog.cache";
import { SITE_URL } from "@/config/site";
import { stripHtml, stripMarkdown } from "@shared/markdown";
import { postPath } from "@shared";
import { messages } from "@/texts";

/** 订阅源包含的最新文章条数 */
const FEED_LIMIT = 20;

/**
 * 转义 XML 特殊字符（& < >），防止标题/摘要破坏 XML 结构
 * @param text 原始文本
 * @returns 可安全嵌入 XML 的文本
 */
function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * GET /rss
 * @returns RSS XML 响应；数据库故障时文章列表降级为空 channel，仍返回 200
 * @warning 条目 link/guid 基于 SITE_URL（取自 NEXT_PUBLIC_BASE_URL，本地定义于根目录 .env.local），
 * 部署环境未注入该变量会输出 localhost 链接。
 */
export async function GET(): Promise<Response> {
  const selfUrl = `${SITE_URL}/rss`;

  // 带重试地拉取最新文章列表；最终失败时降级为空列表而非 500
  const data = await withDbRetry(() => listPostsServer({ page: 1, limit: FEED_LIMIT })).catch(
    () => null,
  );

  // 逐篇生成 <item>：标题去 Markdown、摘要去 HTML 并截断 500 字符，标签输出为 <category>
  const items = (data?.posts ?? [])
    .map((post) => {
      const url = `${SITE_URL}${postPath(post.id)}`;
      const title = stripMarkdown(post.title);
      const description = stripHtml(post.summary || post.content).slice(0, 500);
      const published = post.publishedAt || post.createdAt;

      return [
        "    <item>",
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(published).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  // channel 头部：站点元信息 + self 链接 + 构建时间，随后拼接全部条目
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(messages.meta.siteTitle)}</title>`,
    `    <link>${SITE_URL}</link>`,
    `    <description>${escapeXml(messages.meta.siteDescription)}</description>`,
    "    <language>zh-CN</language>",
    `    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",

      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
