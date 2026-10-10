/**
 * @file page.tsx
 * @description 文章详情页路由（GET /posts/[id]），Server Component。
 * 渲染模式：静态优先——generateStaticParams 预生成最新 100 篇（encodePostId 混淆 ID），
 * 其余 ID 走按需渲染；数据来自 blog.cache（文章缓存 revalidate 300s，DB 故障带重试）。
 * ID 被改名（slug 变更）时经 findRenamedPostId 永久重定向到新地址，否则 404。
 * 附带 Article/BreadcrumbList 结构化数据脚本，供搜索引擎富摘要使用。
 */
import { Container } from "@/components/ui/Container";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { formatTemplate, messages } from "@/texts";
import type { Metadata } from "next";
import "@/app/styles/hljs-theme.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getInitials, splitName } from "@shared/format";

import { estimateReadingTime, stripHtml, stripMarkdown } from "@shared/markdown";
import { decodePostId, encodePostId, postPath } from "@shared";
import {
  getPublicPostServer,
  getPublicCommentsServer,
  getNeighborPostsServer,
  listPostsServer,
  findRenamedPostId,
  withDbRetry,
} from "@server/blog/blog.cache";
import { SITE_URL, STATIC_PARAMS_LIMIT, COMMENT_PAGE_SIZE } from "@/config/site";

import { pageAlternates } from "@/lib/seo";
import { isOptimizableImageSrc } from "@/lib/url";
import type { NeighborPostsData } from "@shared";
import { tagClassFor, tagVariantFor } from "@/components/ui/Tag";
import { PostActions } from "@/components/blog/PostActions";
import { PostHeadStats } from "@/components/blog/PostHeadStats";
import { PostToc } from "@/components/blog/PostToc";
import { AuthorActions } from "@/components/blog/AuthorActions";
import { ViewReporter } from "@/components/blog/ViewReporter";
import { LazyComments, LazyBackToTop } from "@/components/blog/LazyIslands";
import { PostStateProvider } from "@/components/blog/PostStateProvider";
import { BackLink } from "@/components/blog/BackLink";

/**
 * 构建静态预渲染参数列表：取最新 STATIC_PARAMS_LIMIT（100）篇文章的编码 ID。
 * @returns params 数组；拉取失败或无数据时返回占位 ID，避免构建中断
 */
export async function generateStaticParams() {
  try {
    const data = await listPostsServer({ page: 1, limit: STATIC_PARAMS_LIMIT });

    const params = data.posts.map((p) => ({ id: encodePostId(p.id) }));
    if (params.length > 0) return params;
  } catch {}

  return [{ id: "placeholder" }];
}

/**
 * 文章改名（slug 变更）检测：命中则 301 永久重定向到新地址，帮助旧链接与 SEO 平滑迁移
 * @param id 旧文章 ID
 */
async function redirectIfRenamed(id: string): Promise<void> {
  const newId = await findRenamedPostId(id);
  if (!newId) return;
  permanentRedirect(postPath(newId));
}

/**
 * 生成文章详情页 metadata：标题（去 Markdown）、摘要截断 160 字符、OG/Twitter article 卡片与封面图。
 * @param props params - Promise，Next.js 注入的路径参数 { id: 编码后的文章 ID }
 * @returns 该文章 Metadata；文章不存在时先尝试改名重定向，否则返回带 noindex 的站点默认标题
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = decodePostId(rawId);
  const metaResult = await getPublicPostServer(id);
  if (!metaResult) {
    await redirectIfRenamed(id);
    return {
      title: messages.meta.siteTitle,
      robots: { index: false, follow: false },
    };
  }
  const { post } = metaResult;
  const cleanTitle = stripMarkdown(post.title);

  const description = stripHtml(post.summary || post.content).slice(0, 160);

  return {
    title: `${cleanTitle} · ${messages.meta.siteTitle}`,
    description,
    alternates: pageAlternates(postPath(id)),
    openGraph: {
      title: cleanTitle,
      description,
      type: "article",

      ...(post.coverImage && { images: [post.coverImage] }),
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description,
      ...(post.coverImage && { images: [post.coverImage] }),
    },
  };
}

/**
 * 上一篇/下一篇导航卡片
 * @param props neighborPosts - 相邻文章数据（{ prev, next }），两侧均缺失时组件不渲染
 */
async function NeighborPosts({ neighborPosts }: { neighborPosts: NeighborPostsData | null }) {
  const prevPost = neighborPosts?.prev ?? null;

  const nextPost = neighborPosts?.next ?? null;

  if (!prevPost && !nextPost) return null;

  return (
    <nav className="mt-10 mb-8 grid gap-4 sm:grid-cols-2">
      {prevPost ? (
        <Link
          href={postPath(prevPost.id)}
          className="group flex flex-col gap-1 card card-hover p-4"
        >
          <span className="flex items-center gap-1 text-(length:--type-2xs) font-medium text-faint">
            <ChevronLeft size={14} strokeWidth={2.5} />
            {messages.post.prevPost}
          </span>
          <span className="line-clamp-2 text-(length:--type-sm) font-semibold text-heading transition-colors duration-[var(--duration-fast)] group-hover:text-accent">
            {stripMarkdown(prevPost.title)}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}

      {nextPost ? (
        <Link
          href={postPath(nextPost.id)}
          className="group flex flex-col gap-1 card card-hover p-4 text-right max-sm:text-left"
        >
          <span className="flex items-center justify-end gap-1 text-(length:--type-2xs) font-medium text-faint">
            {messages.post.nextPost}
            <ChevronRight size={14} strokeWidth={2.5} />
          </span>
          <span className="line-clamp-2 text-(length:--type-sm) font-semibold text-heading transition-colors duration-[var(--duration-fast)] group-hover:text-accent">
            {stripMarkdown(nextPost.title)}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}
    </nav>
  );
}

/**
 * 文章详情页
 * @param props params - Promise，Next.js 注入的路径参数 { id: 编码后的文章 ID（decodePostId 还原） }
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;

  const id = decodePostId(rawId);

  // 相邻文章与首屏评论并行发起（不 await），主文章数据就绪后再收取，减少总等待时间
  const neighborsPromise = getNeighborPostsServer(id).catch(() => null);

  const commentsPromise = getPublicCommentsServer(id, COMMENT_PAGE_SIZE).catch(() => null);

  // 主数据带 DB 重试；查不到先判断是否改名重定向，否则走 404
  const postResult = await withDbRetry(() => getPublicPostServer(id));
  if (!postResult) {
    await redirectIfRenamed(id);
    notFound();
  }
  const { post } = postResult;

  /** 评论首屏种子数据（LazyComments 水合起点），失败降级为 null 由客户端自拉 */
  const seedComments = await commentsPromise;

  const neighborPosts = await neighborsPromise;

  // 作者姓名拆分并计算头像首字母缩写
  const { firstName, lastName } = splitName(post.authorName || "");

  const authorInitials = post.authorName ? getInitials(firstName, lastName) : "";

  const categoryLabel = post.category;

  return (
    // 帖子状态上下文：向点赞/收藏等客户端岛屿组件提供初始文章数据（正文不下发，减小首屏体积）
    <PostStateProvider initialPost={{ ...post, content: "", contentRaw: undefined }}>
      <Container className="page-section">
        {/* 正文 + 右侧目录（TOC）两栏布局，窄屏单栏 */}
        <div className="grid grid-cols-1 gap-10 pb-12 max-lg:gap-0 max-lg:pb-8 lg:grid-cols-[1fr_220px]">
          <article>
            {/* 返回列表链接 */}
            <BackLink />

            {/* 文章头部：分类 chip、标题、摘要、作者信息与头部统计 */}
            <header className="mb-10 animate-fade-in">
              <div className="mb-5 row-sm">
                <span className="chip">{categoryLabel}</span>
              </div>

              <h1 className="mt-0 display-serif text-(length:--type-2xl) leading-tight font-bold tracking-[-0.025em] text-balance text-heading max-md:text-(length:--type-xl)">
                {stripMarkdown(post.title)}
              </h1>

              <p className="mt-5 text-(length:--type-base) leading-normal text-body max-md:text-(length:--type-sm)">
                {stripHtml(post.summary)}
              </p>

              <div className="mt-8 row-lg flex-wrap border-t border-stroke pt-6">
                <div className="flex items-center gap-3 max-md:gap-2.5">
                  <Avatar size="lg" initials={authorInitials} />
                  <div className="flex flex-col gap-1">
                    <span className="text-(length:--type-sm) leading-normal font-semibold text-heading">
                      {post.authorName}
                    </span>
                    <span className="meta-text">
                      {formatDate(post.publishedAt || post.createdAt)} ·{" "}
                      {formatTemplate(messages.post.readingTime, {
                        minutes: estimateReadingTime(post.content),
                      })}
                    </span>
                  </div>
                </div>
                <PostHeadStats />
              </div>

              <AuthorActions postId={post.id} authorId={post.authorId} />
            </header>

            {/* 封面图：有配置时渲染，宽屏 21:9、移动端 16:9，首屏优先加载 */}
            {post.coverImage && (
              <Image
                src={post.coverImage}
                alt={post.title}
                width={1200}
                height={514}
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 1200px, 1200px"
                unoptimized={!isOptimizableImageSrc(post.coverImage)}
                priority
                className="mb-10 aspect-21/9 w-full animate-fade-in rounded-2xl object-cover max-md:aspect-16/9"
              />
            )}

            {/* 正文区域：服务端渲染的 HTML（含代码高亮样式 hljs-theme），下方依次为标签、互动操作、浏览量上报、懒加载评论 */}
            <div id="article-content" className="animate-fade-in">
              {/* 文章 HTML 正文（服务端已渲染，dangerouslySetInnerHTML 注入） */}
              <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content }} />

              {/* 标签徽章组：点击跳转列表页对应标签筛选 */}
              {post.tags?.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-stroke pt-8">
                  {post.tags.map((t) => (
                    <Link
                      key={t}
                      href={`/posts?tag=${encodeURIComponent(t)}`}
                      className={`badge-lg ${tagClassFor[tagVariantFor(t)]}`}
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              )}

              {/* 点赞/收藏等互动操作（初始未登录态，由客户端水合真实用户） */}
              <PostActions user={null} />

              {/* 浏览量上报客户端组件：挂载后调用 POST /api/posts/[id]/view */}
              <ViewReporter postId={post.id} />

              {/* 评论区懒加载岛屿：以首屏种子数据水合，滚动到视口附近再加载完整交互 */}
              <LazyComments
                postId={post.id}
                user={null}
                postAuthorId={post.authorId}
                initialData={seedComments}
              />
            </div>

            {/* 上一篇/下一篇导航 */}
            <NeighborPosts neighborPosts={neighborPosts} />
          </article>

          {/* 右侧文章目录（TOC），锚点指向 #article-content 内的标题 */}
          <PostToc articleId="article-content" />
        </div>

        {/* 返回顶部悬浮按钮（滚动超过阈值后出现） */}
        <LazyBackToTop />

        {/* 结构化数据：schema.org Article，供搜索引擎富摘要（< 转义防 XSS） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `${SITE_URL}${postPath(id)}`,
              },
              headline: stripMarkdown(post.title),
              description: stripHtml(post.summary),
              datePublished: post.publishedAt || post.createdAt,
              dateModified: post.updatedAt || post.publishedAt || post.createdAt,
              author: {
                "@type": "Person",
                name: post.authorName,
              },
              ...(post.coverImage ? { image: post.coverImage } : {}),
            }).replace(/</g, "\\u003c"),
          }}
        />

        {/* 结构化数据：schema.org BreadcrumbList（首页 → 文章列表 → 当前文章） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: messages.nav.home,
                  item: SITE_URL,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: messages.nav.posts,
                  item: `${SITE_URL}/posts`,
                },
                { "@type": "ListItem", position: 3, name: stripMarkdown(post.title) },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
      </Container>
    </PostStateProvider>
  );
}
