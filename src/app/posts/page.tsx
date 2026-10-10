import { Container } from "@/components/ui/Container";
import type { Metadata } from "next";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { PostCard } from "@/components/post/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PinnedBadge } from "@/components/ui/PinnedBadge";
import { PageHeader } from "@/components/shell/PageHeader";
import { withDbRetry } from "@server/common/db";
import { listPostsCached, listCategoriesCached, listTagsCached } from "@server/post/post.cache";
import { PAGE_SIZE } from "@/config/site";
import { ALL_CATEGORY } from "@/lib/category";
import common from "@/texts/common";
import meta from "@/texts/meta";
import postList from "@/texts/post-list";
import { formatTemplate } from "@/texts/format";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageAlternates } from "@/lib/seo";
import { PostSidebar } from "@/components/post/PostSidebar";
import { PostSearchInput } from "@/components/post/PostSearchInput";
import { buildPostsUrl } from "@/lib/build-posts-url";
import { postPath } from "@shared";

export function generateMetadata(): Metadata {
  return {
    title: `${postList.title} · ${meta.siteTitle}`,
    description: postList.subtitle,

    alternates: pageAlternates("/posts"),
  };
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const category = typeof params.category === "string" ? params.category : undefined;

  const tag = typeof params.tag === "string" ? params.tag : undefined;

  const page = Number(params.page) || 1;

  const rawSearch = typeof params.q === "string" ? params.q : undefined;

  const searchTerm = rawSearch?.trim() || undefined;

  const baseParams: Record<string, string | undefined> = {
    category,
    tag,
    q: rawSearch,
    page: page > 1 ? String(page) : undefined,
  };

  const [postsResult, categoriesResult, tagsResult] = await Promise.all([
    withDbRetry(() =>
      listPostsCached({
        category: category !== ALL_CATEGORY ? category : undefined,
        tag: tag ?? undefined,

        q: searchTerm,
        page,
        limit: PAGE_SIZE,
      }),
    ).catch(() => null),
    listCategoriesCached().catch(() => ({ categories: [] })),
    listTagsCached().catch(() => ({ tags: [] })),
  ]);

  const postsLoadError = postsResult === null;

  const categories = [ALL_CATEGORY, ...(categoriesResult?.categories ?? [])];

  const tags = tagsResult?.tags ?? [];

  const currentCategory = category ?? ALL_CATEGORY;

  const currentTag = tag ?? null;

  if (
    !postsLoadError &&
    postsResult &&
    page > postsResult.totalPages &&
    postsResult.totalPages > 0
  ) {
    const correctedParams = new URLSearchParams();
    for (const [key, value] of Object.entries(baseParams)) {
      if (value && key !== "page") correctedParams.set(key, value);
    }
    correctedParams.set("page", String(postsResult.totalPages));
    redirect(`/posts?${correctedParams.toString()}`);
  }

  const posts = postsResult?.posts ?? [];

  const total = postsResult?.total ?? 0;

  const totalPages = Math.max(1, postsResult?.totalPages ?? 1);

  const rawPage = postsResult?.page ?? page;

  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const hasFilters = !!(searchTerm || category || tag);

  const activeFilters: { key: string; label: string; href: string }[] = [];

  if (searchTerm) {
    activeFilters.push({
      key: "q",
      label: searchTerm,
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
      <PageHeader title={postList.title} subtitle={postList.subtitle} />

      <PostSidebar
        categories={categories}
        tags={tags}
        currentCategory={currentCategory}
        currentTag={currentTag}
        isEmpty={posts.length === 0}
      >
        <div className="mb-6 page-actions animate-fade-in">
          <p className="text-(length:--type-xs) leading-normal font-medium text-body">
            {totalPages > 1
              ? formatTemplate(postList.totalWithPage, {
                  count: total,
                  current: currentPage,
                  total: totalPages,
                })
              : formatTemplate(postList.totalOnly, { count: total })}
          </p>
          <div className="row-md flex-wrap">
            <PostSearchInput initialValue={rawSearch ?? ""} />

            {activeFilters.length > 0 && (
              <div className="row-md flex-wrap" role="group" aria-label={postList.filter}>
                {activeFilters.map((f) => (
                  <Link
                    key={f.key}
                    href={f.href}
                    aria-label={formatTemplate(postList.removeFilterAria, { name: f.label })}
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
                    {postList.clearFilters}
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
              title={postList.loadErrorTitle}
              description={postList.loadErrorDesc}
              action={
                <Button href="/posts" variant="ghost">
                  {common.refresh}
                </Button>
              }
            />
          </div>
        ) : posts.length === 0 ? (
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={postList.noResultsTitle}
              description={postList.noResultsDesc}
              action={
                hasFilters ? (
                  <Button href="/posts" variant="ghost">
                    {postList.clearFilters}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="card-list animate-fade-in">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                href={postPath(post.id)}
                tags={post.tags}
                badge={post.pinned ? <PinnedBadge /> : undefined}
                priority={index < 2}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-2"
            aria-label={postList.pagination}
          >
            {currentPage === 1 ? (
              <span
                className="pointer-events-none page-btn w-9 opacity-40"
                aria-label={postList.prevPage}
              >
                <ChevronLeft size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.max(1, currentPage - 1)),
                })}
                className="page-btn w-9"
                aria-label={postList.prevPage}
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            {pageNumbers.map((n) => (
              <Link
                key={n}
                href={buildPostsUrl(baseParams, { page: String(n) })}
                aria-current={n === currentPage ? "page" : undefined}
                aria-label={formatTemplate(postList.pageN, { n })}
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
                aria-label={postList.nextPage}
              >
                <ChevronRight size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.min(totalPages, currentPage + 1)),
                })}
                className="page-btn w-9"
                aria-label={postList.nextPage}
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
