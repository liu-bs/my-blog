import { withDbRetry } from "@server/common/db";
import { listPostsCached } from "@server/post/post.cache";
import { SITE_URL } from "@/config/site";
import { stripHtml, stripMarkdown } from "@shared/markdown";
import { postPath } from "@shared";
import meta from "@/texts/meta";

const FEED_LIMIT = 20;

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(): Promise<Response> {
  const selfUrl = `${SITE_URL}/rss`;

  const feedPage = await withDbRetry(() => listPostsCached({ page: 1, limit: FEED_LIMIT })).catch(
    () => null,
  );

  const items = (feedPage?.posts ?? [])
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

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(meta.siteTitle)}</title>`,
    `    <link>${SITE_URL}</link>`,
    `    <description>${escapeXml(meta.siteDescription)}</description>`,
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
