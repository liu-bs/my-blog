import type { MetadataRoute } from "next";
import { listPostsServer, getCategoriesServer, getTagsServer } from "@server/blog/blog.cache";
import { SITE_URL, SITEMAP_LIMIT } from "@/config/site";
import { postPath } from "@shared";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const generatedAt = new Date();

  const [postsData, categoriesData, tagsData] = await Promise.all([
    listPostsServer({ page: 1, limit: SITEMAP_LIMIT }).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  const latestPostTime = (postsData?.posts ?? []).reduce<Date | undefined>((acc, post) => {
    const t = new Date(post.updatedAt || post.createdAt);
    return !acc || t > acc ? t : acc;
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

  const postPages: MetadataRoute.Sitemap = (postsData?.posts ?? []).map((post) => ({
    url: `${baseUrl}${postPath(post.id)}`,
    lastModified: new Date(post.updatedAt || post.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = (categoriesData.categories ?? []).map((c) => ({
    url: `${baseUrl}/posts?category=${encodeURIComponent(c)}`,

    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const tagPages: MetadataRoute.Sitemap = (tagsData.tags ?? []).map((t) => ({
    url: `${baseUrl}/posts?tag=${encodeURIComponent(t.name)}`,
    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...postPages, ...categoryPages, ...tagPages];
}
