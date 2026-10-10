import { Container } from "@/components/ui/Container";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import meta from "@/texts/meta";
import nav from "@/texts/nav";
import postDetail from "@/texts/post-detail";
import { formatTemplate } from "@/texts/format";
import type { Metadata } from "next";
import "@/app/styles/hljs-theme.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getInitials, splitName } from "@shared/format";

import { estimateReadingTime, stripHtml, stripMarkdown } from "@shared/markdown";
import { decodePostId, encodePostId, postPath } from "@shared";
import { withDbRetry } from "@server/common/db";
import { listCommentsCached } from "@server/comment/comment.cache";
import {
  getPostCached,
  getNeighborPostsCached,
  getRenamedPostId,
  listPostsCached,
} from "@server/post/post.cache";
import { SITE_URL, STATIC_PARAMS_LIMIT, COMMENT_PAGE_SIZE } from "@/config/site";

import { pageAlternates } from "@/lib/seo";
import { isOptimizableImageSrc } from "@/lib/url";
import type { NeighborPostsData } from "@shared";
import { tagClassFor, tagVariantFor } from "@/components/ui/Tag";
import { PostActions } from "@/components/post/PostActions";
import { PostHeadStats } from "@/components/post/PostHeadStats";
import { PostToc } from "@/components/post/PostToc";
import { AuthorActions } from "@/components/post/AuthorActions";
import { PostViewTracker } from "@/components/post/PostViewTracker";
import { DeferredComments, DeferredBackToTop } from "@/components/post/DeferredPostWidgets";
import { PostStateProvider } from "@/components/post/PostStateProvider";
import { BackLink } from "@/components/post/BackLink";

export async function generateStaticParams() {
  try {
    const indexedPosts = await listPostsCached({ page: 1, limit: STATIC_PARAMS_LIMIT });

    const params = indexedPosts.posts.map((post) => ({ id: encodePostId(post.id) }));
    if (params.length > 0) return params;
  } catch {}

  return [{ id: "placeholder" }];
}

async function redirectIfRenamed(id: string): Promise<void> {
  const newId = await getRenamedPostId(id);
  if (!newId) return;
  permanentRedirect(postPath(newId));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = decodePostId(rawId);
  const metaResult = await getPostCached(id);
  if (!metaResult) {
    await redirectIfRenamed(id);
    return {
      title: meta.siteTitle,
      robots: { index: false, follow: false },
    };
  }
  const { post } = metaResult;
  const cleanTitle = stripMarkdown(post.title);

  const description = stripHtml(post.summary || post.content).slice(0, 160);

  return {
    title: `${cleanTitle} · ${meta.siteTitle}`,
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
            {postDetail.prevPost}
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
            {postDetail.nextPost}
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

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;

  const id = decodePostId(rawId);

  const neighborsPromise = getNeighborPostsCached(id).catch(() => null);

  const commentsPromise = listCommentsCached(id, COMMENT_PAGE_SIZE).catch(() => null);

  const postResult = await withDbRetry(() => getPostCached(id));
  if (!postResult) {
    await redirectIfRenamed(id);
    notFound();
  }
  const { post } = postResult;

  const seedComments = await commentsPromise;

  const neighborPosts = await neighborsPromise;

  const { firstName, lastName } = splitName(post.authorName || "");

  const authorInitials = post.authorName ? getInitials(firstName, lastName) : "";

  const categoryLabel = post.category;

  return (
    <PostStateProvider initialPost={{ ...post, content: "", contentRaw: undefined }}>
      <Container className="page-section">
        <div className="grid grid-cols-1 gap-10 pb-12 max-lg:gap-0 max-lg:pb-8 lg:grid-cols-[1fr_220px]">
          <article>
            <BackLink />

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
                      {formatTemplate(postDetail.readingTime, {
                        minutes: estimateReadingTime(post.content),
                      })}
                    </span>
                  </div>
                </div>
                <PostHeadStats />
              </div>

              <AuthorActions postId={post.id} authorId={post.authorId} />
            </header>

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

            <div id="post-content" className="animate-fade-in">
              <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />

              {post.tags?.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-stroke pt-8">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/posts?tag=${encodeURIComponent(tag)}`}
                      className={`badge-lg ${tagClassFor[tagVariantFor(tag)]}`}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}

              <PostActions user={null} />

              <PostViewTracker postId={post.id} />

              <DeferredComments
                postId={post.id}
                user={null}
                postAuthorId={post.authorId}
                initialData={seedComments}
              />
            </div>

            <NeighborPosts neighborPosts={neighborPosts} />
          </article>

          <PostToc contentId="post-content" />
        </div>

        <DeferredBackToTop />

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
                  name: nav.home,
                  item: SITE_URL,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: nav.posts,
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
