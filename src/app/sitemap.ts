/**
 * @file sitemap.ts
 * @description 站点 sitemap.xml 生成路由（/sitemap.xml）。
 *              不调用 connection()，全部数据读取走 'use cache' 缓存函数（文章/分类/标签），
 *              可在构建期静态生成；单数据源失败时兜底为空，不阻塞其余部分输出
 */
import type { MetadataRoute } from "next";
import { listPostsServer, getCategoriesServer, getTagsServer } from "@server/blog/blog.cache";
import { SITE_URL, SITEMAP_LIMIT } from "@/config/site";
import { routing } from "@/i18n/routing";
import { postPath } from "@shared";

/**
 * 生成全站 sitemap 条目
 * @returns 静态页（首页/列表页）、文章详情、分类筛选页、标签筛选页四类 URL，
 *          每类按 routing.locales 逐语言展开，文章 URL 以最近更新时间作为 lastModified
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const locales = routing.locales;

  const generatedAt = new Date();

  // 文章/分类/标签三路缓存读取并行执行，个别失败时以空数据兜底，保证 sitemap 始终可生成
  const [postsData, categoriesData, tagsData] = await Promise.all([
    listPostsServer({ page: 1, limit: SITEMAP_LIMIT }).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  // 全站最近一次内容更新时间，用作静态页 lastModified
  const latestPostTime = (postsData?.posts ?? []).reduce<Date | undefined>((acc, post) => {
    const t = new Date(post.updatedAt || post.createdAt);
    return !acc || t > acc ? t : acc;
  }, undefined);

  const staticPages: MetadataRoute.Sitemap = locales.flatMap((locale) => [
    {
      url: `${baseUrl}/${locale}`,
      lastModified: latestPostTime ?? generatedAt,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/${locale}/posts`,
      lastModified: latestPostTime ?? generatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ]);

  const postPages: MetadataRoute.Sitemap = (postsData?.posts ?? []).flatMap((post) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${postPath(post.id)}`,
      lastModified: new Date(post.updatedAt || post.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  );

  const categoryPages: MetadataRoute.Sitemap = (categoriesData.categories ?? []).flatMap((c) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/posts?category=${encodeURIComponent(c)}`,

      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  const tagPages: MetadataRoute.Sitemap = (tagsData.tags ?? []).flatMap((t) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/posts?tag=${encodeURIComponent(t.name)}`,
      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  );

  return [...staticPages, ...postPages, ...categoryPages, ...tagPages];
}
