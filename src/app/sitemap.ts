/**
 * @file sitemap.ts
 * @description sitemap.xml 路由（GET /sitemap.xml），服务端动态生成。
 * 汇总静态页（首页/列表页）、文章详情页、分类页与标签页四类 URL，
 * 数据来自 blog.cache 的缓存查询（posts 缓存 revalidate 周期 300s，分类/标签 3600s）。
 */
import type { MetadataRoute } from "next";
import { listPostsServer, getCategoriesServer, getTagsServer } from "@server/blog/blog.cache";
import { SITE_URL, SITEMAP_LIMIT } from "@/config/site";
import { postPath } from "@shared";

/**
 * 生成站点地图
 * @returns Sitemap 条目数组（静态页 → 文章页 → 分类页 → 标签页，优先级依次递减）
 * @warning 所有 URL 基于 SITE_URL 拼接（取自 NEXT_PUBLIC_BASE_URL，本地定义于根目录 .env.local），
 * 部署环境未注入该变量会生成 localhost 条目。
 * 文章列表拉取上限为 SITEMAP_LIMIT，超出部分不会进入 sitemap；数据库故障时文章查询降级为空集合，
 * 仅输出静态页条目，保证 sitemap 不 500。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  /** 本次生成时间，作为无法取得文章更新时间条目的 lastModified 兜底 */
  const generatedAt = new Date();

  // 并行拉取文章/分类/标签，任一失败均降级为空数据而非整体报错
  const [postsData, categoriesData, tagsData] = await Promise.all([
    listPostsServer({ page: 1, limit: SITEMAP_LIMIT }).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  /** 全站文章的最近更新时间（updatedAt 优先），用于静态页 lastModified */
  const latestPostTime = (postsData?.posts ?? []).reduce<Date | undefined>((acc, post) => {
    const t = new Date(post.updatedAt || post.createdAt);
    return !acc || t > acc ? t : acc;
  }, undefined);

  // 静态页：首页与文章列表页，变更频率 daily
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: latestPostTime ?? generatedAt,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: latestPostTime ?? generatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ];

  // 文章详情页：lastModified 取文章自身更新时间，变更频率 weekly
  const postPages: MetadataRoute.Sitemap = (postsData?.posts ?? []).map((post) => ({
    url: `${baseUrl}${postPath(post.id)}`,
    lastModified: new Date(post.updatedAt || post.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // 分类筛选页（/posts?category=xxx），分类名需 URL 编码
  const categoryPages: MetadataRoute.Sitemap = (categoriesData.categories ?? []).map((c) => ({
    url: `${baseUrl}/posts?category=${encodeURIComponent(c)}`,

    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // 标签筛选页（/posts?tag=xxx），优先级最低
  const tagPages: MetadataRoute.Sitemap = (tagsData.tags ?? []).map((t) => ({
    url: `${baseUrl}/posts?tag=${encodeURIComponent(t.name)}`,
    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...postPages, ...categoryPages, ...tagPages];
}
