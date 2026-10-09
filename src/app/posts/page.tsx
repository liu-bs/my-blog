/**
 * @file page.tsx
 * @description 文章列表页路由（GET /posts），Server Component 动态渲染（SSR，每次请求执行）。
 * 支持分类/标签/关键词筛选与分页；数据来自 blog.cache 的缓存查询（文章列表缓存 revalidate 300s）。
 * 页超界时自动 307 重定向到最后一页；数据库故障时降级显示加载失败空态。
 */
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

/**
 * 生成文章列表页 metadata（标题、描述、canonical/alternates 指向 /posts）
 * @returns 该页 Metadata 对象
 */
export function generateMetadata(): Metadata {
  return {
    title: `${messages.posts.title} · ${messages.meta.siteTitle}`,
    description: messages.posts.subtitle,

    alternates: pageAlternates("/posts"),
  };
}

/**
 * 文章列表页
 * @param props searchParams - Next.js 异步查询参数（Promise 形式，须 await）：
 * category 分类名、tag 标签名、q 搜索关键词、page 页码（非法值回退为 1）
 */
export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  // ---- 解析筛选与分页参数 ----
  const category = typeof sp.category === "string" ? sp.category : undefined;

  const tag = typeof sp.tag === "string" ? sp.tag : undefined;

  const page = Number(sp.page) || 1;

  const q = typeof sp.q === "string" ? sp.q : undefined;

  /** 去除首尾空白后的搜索词，空串视为无搜索 */
  const query = q?.trim() || undefined;

  /** 当前筛选条件的规范化集合，供分页/移除筛选链接复用 */
  const baseParams: Record<string, string | undefined> = {
    category,
    tag,
    q,
    page: page > 1 ? String(page) : undefined,
  };

  // ---- 并行拉取文章列表 + 分类/标签侧栏数据，任一失败降级为空 ----
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

  /** 文章列表加载失败标记（Promise 降级为 null） */
  const postsLoadError = postsResult === null;

  /** 分类列表，首位插入"全部"选项 */
  const categories = [ALL_CATEGORY, ...(categoriesData?.categories ?? [])];

  const tags = tagsData?.tags ?? [];

  /** 当前选中分类（未筛选时为"全部"） */
  const currentCategory = category ?? ALL_CATEGORY;

  /** 当前选中标签（未筛选时为 null） */
  const currentTag = tag ?? null;

  // 页码超出总页数：保留其余筛选条件，重定向到最后一页（修正不可达的旧分页链接）
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

  /** 符合筛选条件的文章总数（用于统计文案） */
  const total = postsResult?.total ?? 0;

  /** 总页数，至少为 1 */
  const totalPages = Math.max(1, postsResult?.totalPages ?? 1);

  const rawPage = postsResult?.page ?? page;

  /** 当前页，钳制在 [1, totalPages] 区间内 */
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  /** 是否处于任一筛选状态（决定空结果时是否展示"清除筛选"按钮） */
  const hasFilters = !!(query || category || tag);

  // ---- 已激活筛选标签 chips：每个 chip 的 href 为"移除该条件后的列表 URL" ----
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

  // ---- 分页页码窗口：最多显示 5 个页码，当前页尽量居中 ----
  const maxPages = Math.min(5, totalPages);

  let pageStart = Math.max(1, currentPage - 2);

  const pageEnd = Math.min(totalPages, pageStart + maxPages - 1);

  // 尾部空间不足时向前补齐窗口起点，保证满 5 个页码
  pageStart = Math.max(1, pageEnd - maxPages + 1);

  const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <Container className="page-section">
      {/* 页面标题区 */}
      <PageHeader title={messages.posts.title} subtitle={messages.posts.subtitle} />

      {/* 主体 + 侧栏（分类/标签筛选）布局容器 */}
      <PostSidebar
        categories={categories}
        tags={tags}
        currentCategory={currentCategory}
        currentTag={currentTag}
        zeroResults={posts.length === 0}
      >
        {/* 工具条：结果统计文案 + 搜索框 + 已激活筛选 chips */}
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

        {/* 列表主体三态：加载失败空态 → 无结果空态（可清除筛选） → 文章卡片列表 */}
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
            {/* 文章卡片列表：置顶文章带徽章，前两张图优先加载（priority） */}
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

        {/* 分页导航：上一页/页码窗口/下一页，首尾页对应按钮置为禁用态 */}
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
