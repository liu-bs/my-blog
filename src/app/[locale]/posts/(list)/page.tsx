/**
 * @file page.tsx
 * @description 文章列表页（Server Component）：支持分类/标签/搜索词/页码四类查询参数，
 *              数据走 'use cache' 缓存函数并包 withDbRetry 容忍数据库冷启动；
 *              页码越界时 redirect 到最后一页，加载失败降级为错误空态，含侧栏筛选与分页导航
 */
import { Container } from "@/components/ui/Container";
import type { Metadata } from "next";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
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
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PostSidebar } from "@/components/blog/PostSidebar";
import { PostsSearchInput } from "@/components/blog/PostsSearchInput";
import { buildPostsUrl } from "@/lib/buildPostsUrl";
import { postPath } from "@shared";

/**
 * 生成列表页元数据
 * @param params 路由参数，含 locale
 * @returns 标题/描述、canonical 与各语言 hreflang 互链（固定指向不带筛选参数的 /posts）
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  const [t, tMeta] = await Promise.all([getTranslations("posts"), getTranslations("meta")]);
  return {
    title: `${t("title")} · ${tMeta("siteTitle")}`,
    description: t("subtitle"),

    alternates: {
      canonical: `/${locale}/posts`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}/posts`])),
        "x-default": `/${routing.defaultLocale}/posts`,
      },
    },
  };
}

/**
 * 文章列表页组件
 * @param params 路由参数，含 locale
 * @param searchParams 查询参数：category/tag/q/page
 * @returns 列表页：侧栏筛选 + 文章卡片 + 分页导航；越界页码 redirect、加载失败降级空态
 */
export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  assertLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations("posts"), getTranslations("common")]);
  const sp = await searchParams;

  const category = typeof sp.category === "string" ? sp.category : undefined;

  const tag = typeof sp.tag === "string" ? sp.tag : undefined;

  const page = Number(sp.page) || 1;

  const q = typeof sp.q === "string" ? sp.q : undefined;

  const baseParams: Record<string, string | undefined> = {
    category,
    tag,
    q,
    page: page > 1 ? String(page) : undefined,
  };

  // 三路数据并行读取：文章分页走 withDbRetry 包裹的缓存函数（失败 catch 为 null 降级），
  // 分类/标签为侧栏数据，失败时兜底为空
  const [postsResult, categoriesData, tagsData] = await Promise.all([
    withDbRetry(() =>
      listPostsServer({
        category: category !== ALL_CATEGORY ? category : undefined,
        tag: tag ?? undefined,

        q: q?.trim() || undefined,
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

  // 页码越界（如手动输入超大 page）时，携带原筛选条件 redirect 到最后一页，避免空列表页
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
    redirect({ href: `/posts?${correctedParams.toString()}`, locale });
  }

  const posts = postsResult?.posts ?? [];

  const total = postsResult?.total ?? 0;

  const totalPages = Math.max(1, postsResult?.totalPages ?? 1);

  const rawPage = postsResult?.page ?? page;

  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const hasFilters = !!(q?.trim() || category || tag);

  // 分页导航窗口：最多展示 5 个页码，以当前页为中心，越靠近首尾自动收拢
  const maxPages = Math.min(5, totalPages);

  let pageStart = Math.max(1, currentPage - 2);

  const pageEnd = Math.min(totalPages, pageStart + maxPages - 1);

  pageStart = Math.max(1, pageEnd - maxPages + 1);

  const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <Container className="page-section">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

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
              ? t("totalWithPage", { count: total, current: currentPage, total: totalPages })
              : t("totalOnly", { count: total })}
          </p>
          <div className="row-md flex-wrap">
            <PostsSearchInput initialValue={q ?? ""} />
          </div>
        </div>

        {/* 数据加载失败：降级为错误空态，引导刷新 */}
        {postsLoadError ? (
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={t("loadErrorTitle")}
              description={t("loadErrorDesc")}
              action={
                <Button href="/posts" variant="ghost">
                  {tCommon("refresh")}
                </Button>
              }
            />
          </div>
        ) : posts.length === 0 ? (
          // 空结果态：带筛选条件时提供"清除筛选"入口
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={t("noResultsTitle")}
              description={t("noResultsDesc")}
              action={
                hasFilters ? (
                  <Button href="/posts" variant="ghost">
                    {t("clearFilters")}
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
                priority={i === 0}
              />
            ))}
          </div>
        )}

        {/* 分页导航：上一页/下一页在边界时渲染为禁用占位符，页码链接保留原筛选参数 */}
        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-2"
            aria-label={t("pagination")}
          >
            {currentPage === 1 ? (
              <span
                className="pointer-events-none page-btn w-9 opacity-40"
                aria-label={t("prevPage")}
              >
                <ChevronLeft size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.max(1, currentPage - 1)),
                })}
                className="page-btn w-9"
                aria-label={t("prevPage")}
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            {pageNumbers.map((n) => (
              <Link
                key={n}
                href={buildPostsUrl(baseParams, { page: String(n) })}
                aria-current={n === currentPage ? "page" : undefined}
                aria-label={t("pageN", { n })}
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
                aria-label={t("nextPage")}
              >
                <ChevronRight size={16} />
              </span>
            ) : (
              <Link
                href={buildPostsUrl(baseParams, {
                  page: String(Math.min(totalPages, currentPage + 1)),
                })}
                className="page-btn w-9"
                aria-label={t("nextPage")}
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
