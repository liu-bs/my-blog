/**
 * @file sitemap.ts
 * @description 生成 /sitemap.xml：把静态页、文章详情、分类页、标签页按 zh / en 各展开一份多语言 URL
 */
import type { MetadataRoute } from "next";
import { listPostsServer, getCategoriesServer, getTagsServer } from "@server/blog/blog.cache";
import { SITE_URL, SITEMAP_LIMIT } from "@/config/site";
import { routing } from "@/i18n/routing";
import { postPath } from "@shared";

/**
 * 生成站点地图
 * @description 每类页面都按 routing.locales 展开，URL 形如 `{baseUrl}/{locale}/...`，与 localePrefix: "always" 的约定一致
 * @returns Next.js MetadataRoute.Sitemap 所需的条目数组
 * @warning 数据源查询全部 catch 成空值：站点地图不应因数据库抖动而整体生成失败，宁可少收录条目
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  /** 参与展开的语言列表（zh、en） */
  const locales = routing.locales;

  /** 生成时刻，作为无更新时间页面的 lastModified 兜底 */
  const generatedAt = new Date();

  /** 并行取文章 / 分类 / 标签，任一失败降级为空集合 */
  const [postsData, categoriesData, tagsData] = await Promise.all([
    listPostsServer({ page: 1, limit: SITEMAP_LIMIT }).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  /** 全部文章中最新的更新时间，用于给首页 / 列表页一个更贴近内容的 lastModified */
  const latestPostTime = (postsData?.posts ?? []).reduce<Date | undefined>((acc, post) => {
    const t = new Date(post.updatedAt || post.createdAt);
    return !acc || t > acc ? t : acc;
  }, undefined);
  /** 静态页（首页、文章列表页）按语言展开，首页 priority 最高 */
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

  /** 每篇文章同样按语言各出一份 URL，详情路径由 postPath 统一生成以避免编码不一致 */
  const postPages: MetadataRoute.Sitemap = (postsData?.posts ?? []).flatMap((post) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${postPath(post.id)}`,
      lastModified: new Date(post.updatedAt || post.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  );

  /** 分类页用查询参数表达筛选，中文分类名需 encodeURIComponent 后再拼进 URL */
  const categoryPages: MetadataRoute.Sitemap = (categoriesData.categories ?? []).flatMap((c) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/posts?category=${encodeURIComponent(c)}`,

      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  /** 标签页同样走查询参数，优先级最低 */
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
