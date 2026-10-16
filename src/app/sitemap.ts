import type { MetadataRoute } from "next";
import { listPostsCached } from "@server/post/post.cache";
import { SITE_URL, SITEMAP_BATCH_SIZE } from "@/config/site";
import type { Post } from "@shared";
import { postPath } from "@shared";

async function collectAllPosts(): Promise<Post[]> {
  const all: Post[] = [];
  for (let page = 1; ; page++) {
    const batch = await listPostsCached({ page, limit: SITEMAP_BATCH_SIZE });
    all.push(...batch.posts);
    if (batch.posts.length < SITEMAP_BATCH_SIZE) break;
    if (page * SITEMAP_BATCH_SIZE >= batch.total) break;
    if (page > 200) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const generatedAt = new Date();

  const posts = await collectAllPosts().catch(() => [] as Post[]);

  const latestPostTime = posts.reduce<Date | undefined>((latest, post) => {
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

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}${postPath(post.id)}`,
    lastModified: new Date(post.updatedAt || post.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...postPages];
}
