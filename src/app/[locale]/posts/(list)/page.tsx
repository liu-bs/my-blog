/**
 * @file posts/(list)/page.tsx
 * @description 文章列表页（Server Component，公开路由，不做登录校验）。
 * 从 searchParams 解析分类 / 标签 / 搜索词 / 页码，并行拉取「文章分页 + 分类 + 标签」三份数据后渲染列表、
 * 筛选侧栏与分页导航；首页地址为 /[locale]/posts，翻页与筛选一律通过 URL query 同步，便于分享与回退。
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
 * 生成列表页 SEO 元信息
 * @description 标题由 i18n 的 posts.title 与站点名拼接，描述取列表页副标题；locale 非法时直接抛错交由上层兜底
 * @param params 动态路由参数，含 locale
 * @returns Next.js Metadata，用于 title 与 description
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  // posts / meta 两个命名空间互不依赖，并行取翻译减少串行等待
  const [t, tMeta] = await Promise.all([getTranslations("posts"), getTranslations("meta")]);
  return {
    title: `${t("title")} · ${tMeta("siteTitle")}`,
    description: t("subtitle"),
    // canonical 固定为不带 query 的列表页本身：筛选/翻页参数视为同一页的变体，避免污染收录
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
 * 文章列表页
 * @description 所有筛选与分页状态都来源于 URL：category / tag / q / page。
 * 参数归一化规则：非 string 类型（如重复参数形成数组）一律视为未传；page 无法解析为非零数字时回退到第 1 页。
 * 数据获取具备降级能力——文章列表失败时展示「加载失败」空态，分类 / 标签失败时退化为空数组，避免整页 500。
 * 另有一处纠正跳转：当请求页码超出结果总页数时，重定向到最后一页，防止出现空白页。
 * @param params 动态路由参数，含 locale
 * @param searchParams 查询参数：category 分类、tag 标签、q 搜索词、page 页码
 * @returns 列表页 JSX
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

  // 仅接受字符串形态的参数，数组（同名参数重复出现）视为未传
  const category = typeof sp.category === "string" ? sp.category : undefined;

  const tag = typeof sp.tag === "string" ? sp.tag : undefined;

  // Number 解析失败得到 NaN，会被 || 兜底为第 1 页
  const page = Number(sp.page) || 1;

  const q = typeof sp.q === "string" ? sp.q : undefined;

  /** 当前筛选条件的快照，作为拼装分页链接的基础；page=1 时省略，使首页 URL 更干净 */
  const baseParams: Record<string, string | undefined> = {
    category,
    tag,
    q,
    page: page > 1 ? String(page) : undefined,
  };

  // 三份数据相互独立故并行请求；listPosts 包一层 withDbRetry 应对 Neon 冷启动抖动，各自 catch 成中性值实现优雅降级
  const [postsResult, categoriesData, tagsData] = await Promise.all([
    withDbRetry(() =>
      listPostsServer({
        // "全部" 分类是前端虚拟项，不下传数据库
        category: category !== ALL_CATEGORY ? category : undefined,
        tag: tag ?? undefined,
        // 纯空白搜索词没有语义，视为未搜索
        q: q?.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    ).catch(() => null),
    getCategoriesServer().catch(() => ({ categories: [] })),
    getTagsServer().catch(() => ({ tags: [] })),
  ]);

  /** 文章列表是否拉取失败（区别于「筛选后确实没有结果」） */
  const postsLoadError = postsResult === null;

  /** 分类选项列表，固定以「全部」打头供侧栏展示 */
  const categories = [ALL_CATEGORY, ...(categoriesData?.categories ?? [])];

  const tags = tagsData?.tags ?? [];

  const currentCategory = category ?? ALL_CATEGORY;

  const currentTag = tag ?? null;

  // 页码越界纠正：仅在数据加载成功且确有结果时跳转，避免把真实的空结果误判为越界
  if (
    !postsLoadError &&
    postsResult &&
    page > postsResult.totalPages &&
    postsResult.totalPages > 0
  ) {
    const correctedParams = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      // page 稍后单独覆盖为目标末页，此处先跳过
      if (v && k !== "page") correctedParams.set(k, v);
    }
    correctedParams.set("page", String(postsResult.totalPages));
    redirect({ href: `/posts?${correctedParams.toString()}`, locale });
  }

  const posts = postsResult?.posts ?? [];

  const total = postsResult?.total ?? 0;

  const totalPages = Math.max(1, postsResult?.totalPages ?? 1);

  const rawPage = postsResult?.page ?? page;

  // 以服务端返回的页码为准并夹紧到 [1, totalPages]，保证分页器高亮与链接可点击
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  /** 是否存在生效中的筛选条件，决定「无结果」空态是否展示「清除筛选」按钮 */
  const hasFilters = !!(q?.trim() || category || tag);

  // 分页器最多展示 5 个页码，此处通过先向后取满、再向前回拉的方式保证当前页尽量居中
  const maxPages = Math.min(5, totalPages);

  let pageStart = Math.max(1, currentPage - 2);

  const pageEnd = Math.min(totalPages, pageStart + maxPages - 1);

  pageStart = Math.max(1, pageEnd - maxPages + 1);

  /** 待渲染的页码数组 */
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
        {/* 列表顶部操作区：结果统计 + 搜索框 */}
        <div className="mb-6 page-actions animate-fade-in">
          <p className="text-(length:--type-xs) leading-normal font-medium text-body">
            {/* 多页时展示「第 X / Y 页」，单页时只展示总数 */}
            {totalPages > 1
              ? t("totalWithPage", { count: total, current: currentPage, total: totalPages })
              : t("totalOnly", { count: total })}
          </p>
          <div className="row-md flex-wrap">
            <PostsSearchInput initialValue={q ?? ""} />
          </div>
        </div>

        {/* 三种互斥状态：加载失败 / 无结果 / 正常列表 */}
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
          <div className="animate-fade-in">
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={t("noResultsTitle")}
              description={t("noResultsDesc")}
              action={
                // 无筛选条件时清空筛选没有意义，故不渲染按钮
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
            {/* 首篇文章作为 LCP 元素优先加载图片 */}
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

        {/* 仅多页时渲染分页器；首/末页的上一页、下一页按钮降级为不可点击的占位 span */}
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
