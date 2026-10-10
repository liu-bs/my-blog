import { Container } from "@/components/ui/Container";
import type { Metadata } from "next";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PinnedBadge } from "@/components/ui/PinnedBadge";
import { PageHeader } from "@/components/layouts/PageHeader";
import {
  listPostsServer,
  getCategoriesServer,
  getTagsServer,
  withDbRetry,
} from "@server/blog/blog.cache";
import { PAGE_SIZE } from "@/config/site";
import { ALL_CATEGORY } from "@/lib/category";
import { formatTemplate, messages } from "@/texts";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageAlternates } from "@/lib/seo";
import { PostSidebar } from "@/components/blog/PostSidebar";
import { PostsSearchInput } from "@/components/blog/PostsSearchInput";
import { buildPostsUrl } from "@/lib/buildPostsUrl";
import { postPath } from "@shared";

export function generateMetadata(): Metadata {
  return {
    title: `${messages.posts.title} · ${messages.meta.siteTitle}`,
    description: messages.posts.subtitle,

    alternates: pageAlternates("/posts"),
  };
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const category = typeof sp.category === "string" ? sp.category : undefined;

  const tag = typeof sp.tag === "string" ? sp.tag : undefined;

  const page = Number(sp.page) || 1;

  const q = typeof sp.q === "string" ? sp.q : undefined;

  const query = q?.trim() || undefined;

  const baseParams: Record<string, string | undefined> = {
    category,
    tag,
    q,
    page: page > 1 ? String(page) : undefined,
  };

  const [postsResult, categoriesData, tagsData] = await Promise.all([
    withDbRetry(() =>
      listPostsServer({
        category: category !== ALL_CATEGORY ? category : undefined,
        tag: tag ?? undefined,

        q: query,
        page,
        limit: PAGE_SIZE,
      }),
    ).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  const postsLoadError = postsResult === null;

  const categories = [ALL_CATEGORY, ...(categoriesData?.categories ?? [])];

  const tags = tagsData?.tags ?? [];

  const currentCategory = category ?? ALL_CATEGORY;

  const currentTag = tag ?? null;

  if (
    !postsLoadError &&
    postsResult &&
    page > postsResult.totalPages &&
    postsResult.totalPages > 0
  ) {
    const correctedParams = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v && k !== "page") correctedParams.set(k, v);
    }
    correctedParams.set("page", String(postsResult.totalPages));
    redirect(`/posts?${correctedParams.toString()}`);
  }

  const posts = postsResult?.posts ?? [];

  const total = postsResult?.total ?? 0;

  const totalPages = Math.max(1, postsResult?.totalPages ?? 1);

  const rawPage = postsResult?.page ?? page;

  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const hasFilters = !!(query || category || tag);

  const activeFilters: { key: string; label: string; href: string }[] = [];

  if (query) {
    activeFilters.push({
      key: "q",
      label: query,
      href: buildPostsUrl(baseParams, { q: null }),
    });
  }

  if (category && category !== ALL_CATEGORY) {
    activeFilters.push({
      key: "category",
      label: category,
      href: buildPostsUrl(baseParams, { category: null }),
    });
  }

  if (tag) {
    activeFilters.push({ key: "tag", label: tag, href: buildPostsUrl(baseParams, { tag: null }) });
  }

  const maxPages = Math.min(5, totalPages);

  let pageStart = Math.max(1, currentPage - 2);

  const pageEnd = Math.min(totalPages, pageStart + maxPages - 1);

  pageStart = Math.max(1, pageEnd - maxPages + 1);

  const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <Container className="page-section">

      <PageHeader title={messages.posts.title} subtitle={messages.posts.subtitle} />

      <PostSidebar
        categories={categories}
        tags={tags}
        currentCategory={currentCategory}
        currentTag={currentTag}
        zeroResults={posts.length === 0}
      >

        <div className="mb-6 page-actions animate-fade-in">
          <p className="text-(length:--type-xs) leading-normal font-medium text-body">
            {totalPages > 1
              ? formatTemplate(messages.posts.totalWithPage, {
                  count: total,
                  current: currentPage,
                  total: totalPages,
                })
              : formatTemplate(messages.posts.totalOnly, { count: total })}
          </p>
          <div className="row-md flex-wrap">
            <PostsSearchInput initialValue={q ?? ""} />

            {activeFilters.length > 0 && (
              <div className="row-md flex-wrap" role="group" aria-label={messages.posts.filter}>
                {activeFilters.map((f) => (
                  <Link
                    key={f.key}
                    href={f.href}
                    aria-label={formatTemplate(messages.posts.removeFilterAria, { name: f.label })}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-(length:--type-2xs) leading-normal font-medium text-page shadow-(--shadow-sm) transition-[filter] duration-[var(--duration-fast)] ease-smooth hover:brightness-105"
                  >
                    {f.label}
                    <X size={12} strokeWidth={2.5} aria-hidden />
                  </Link>
                ))}

                {activeFilters.length > 1 && (
                  <Link
                    href="/posts"
                    className="text-(length:--type-2xs) leading-normal text-muted underline decoration-stroke underline-offset-4 transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                  >
                    {messages.posts.clearFilters}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {postsLoadError ? (
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={messages.posts.loadErrorTitle}
              description={messages.posts.loadErrorDesc}
              action={
                <Button href="/posts" variant="ghost">
                  {messages.common.refresh}
                </Button>
              }
            />
          </div>
        ) : posts.length === 0 ? (
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={messages.posts.noResultsTitle}
              description={messages.posts.noResultsDesc}
              action={
                hasFilters ? (
                  <Button href="/posts" variant="ghost">
                    {messages.posts.clearFilters}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="card-list animate-fade-in">

            {posts.map((p, i) => (
              <ArticleCard
                key={p.id}
                post={p}
                href={postPath(p.id)}
                tags={p.tags}
                badge={p.pinned ? <PinnedBadge /> : undefined}
                priority={i < 2}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-2"
            aria-label={messages.posts.pagination}
          >
            {currentPage === 1 ? (
              <span
                className="pointer-events-none page-btn w-9 opacity-40"
                aria-label={messages.posts.prevPage}
              >
                <ChevronLeft size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.max(1, currentPage - 1)),
                })}
                className="page-btn w-9"
                aria-label={messages.posts.prevPage}
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            {pageNumbers.map((n) => (
              <Link
                key={n}
                href={buildPostsUrl(baseParams, { page: String(n) })}
                aria-current={n === currentPage ? "page" : undefined}
                aria-label={formatTemplate(messages.posts.pageN, { n })}
                className={`page-btn min-w-9 px-2.5 text-(length:--type-xs) ${
                  n === currentPage ? "page-btn-active" : ""
                }`}
              >
                {n}
              </Link>
            ))}
            {currentPage === totalPages ? (
              <span
                className="pointer-events-none page-btn w-9 opacity-40"
                aria-label={messages.posts.nextPage}
              >
                <ChevronRight size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.min(totalPages, currentPage + 1)),
                })}
                className="page-btn w-9"
                aria-label={messages.posts.nextPage}
              >
                <ChevronRight size={16} />
              </Link>
            )}
          </nav>
        )}
      </PostSidebar>
    </Container>
  );
}
