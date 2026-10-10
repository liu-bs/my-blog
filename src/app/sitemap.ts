import type { MetadataRoute } from "next";
import { listPostsCached, listCategoriesCached, listTagsCached } from "@server/post/post.cache";
import { SITE_URL, SITEMAP_LIMIT } from "@/config/site";
import { postPath } from "@shared";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const generatedAt = new Date();

  const [postsResult, categoriesResult, tagsResult] = await Promise.all([
    listPostsCached({ page: 1, limit: SITEMAP_LIMIT }).catch(() => null),
    listCategoriesCached().catch(() => ({ categories: [] })),
    listTagsCached().catch(() => ({ tags: [] })),
  ]);

  const latestPostTime = (postsResult?.posts ?? []).reduce<Date | undefined>((latest, post) => {
    const updatedAt = new Date(post.updatedAt || post.createdAt);
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, undefined);

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

  const postPages: MetadataRoute.Sitemap = (postsResult?.posts ?? []).map((post) => ({
    url: `${baseUrl}${postPath(post.id)}`,
    lastModified: new Date(post.updatedAt || post.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = (categoriesResult.categories ?? []).map(
    (category) => ({
      url: `${baseUrl}/posts?category=${encodeURIComponent(category)}`,

      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }),
  );

  const tagPages: MetadataRoute.Sitemap = (tagsResult.tags ?? []).map((tag) => ({
    url: `${baseUrl}/posts?tag=${encodeURIComponent(tag.name)}`,
    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...postPages, ...categoryPages, ...tagPages];
}
