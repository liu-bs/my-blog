/**
 * @file page.tsx
 * @description 首页（Server Component）：Hero 区展示站点介绍与代码窗口装饰，
 *              下方通过 'use cache' 缓存函数读取最新文章列表；数据加载失败时降级为错误空态，
 *              无文章时不渲染列表区块。缓存函数外再包 withDbRetry 以容忍数据库冷启动
 */
import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinnedBadge } from "@/components/ui/PinnedBadge";
import { WriteCta } from "@/components/blog/WriteCta";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { listPostsServer, withDbRetry } from "@server/blog/blog.cache";
import { postPath } from "@shared";
import { HOME_PAGE_SIZE } from "@/config/site";
import { routing } from "@/i18n/routing";

/**
 * 生成首页元数据
 * @param params 路由参数，含 locale
 * @returns 标题/描述及各语言 hreflang 互链，canonical 指向当前 locale 首页
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);
  const [t, tMeta] = await Promise.all([getTranslations("home"), getTranslations("meta")]);
  return {
    title: `${t("heroKicker")} · ${tMeta("siteTitle")}`,
    description: t("heroLead"),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
        "x-default": `/${routing.defaultLocale}`,
      },
    },
  };
}

/**
 * 首页组件
 * @param params 路由参数，含 locale
 * @returns Hero 区 + 最新文章列表；数据失败时渲染错误空态，无文章时不渲染列表
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  assertLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations("home"), getTranslations("common")]);

  // 'use cache' 缓存读取外层包 withDbRetry：数据库冷启动失败时退避重试；
  // 重试仍失败则 catch 为 null，页面降级为加载错误空态而非抛错
  const postsData = await withDbRetry(() =>
    listPostsServer({ page: 1, limit: HOME_PAGE_SIZE }),
  ).catch(() => null);

  const latestPosts = postsData?.posts ?? [];

  const postsLoadError = postsData === null;

  // 总数超过当前页条数时，"查看全部"按钮附带文章总数
  const hasMore = (postsData?.total ?? 0) > latestPosts.length;

  const hasPosts = latestPosts.length > 0;

  return (
    <>
      <section className="hero-section" aria-label={t("heroSection")}>
        <Container>
          <div className="grid grid-cols-1 items-center gap-(--space-10) max-lg:gap-10 lg:grid-cols-[1fr_480px]">
            <div className="max-w-152 max-lg:max-w-none">
              <div className="m-0 mb-8 row-sm flex animate-fade-in">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 animate-breathing rounded-full hero-dot"
                  aria-hidden="true"
                />
                <span className="text-(length:--type-xs) font-medium tracking-[0.02em] text-muted">
                  {t("heroBadge")}
                </span>
              </div>

              <p className="m-0 hero-kicker mb-3 animate-fade-in">{t("heroKicker")}</p>
              <h1 className="m-0 mb-8 animate-fade-in text-balance">
                <span className="hero-headline text-heading">{t("heroTitle")}</span>
              </h1>

              <p className="m-0 mb-10 animate-fade-in hero-lead text-body">{t("heroLead")}</p>

              <div className="flex animate-fade-in flex-wrap items-center gap-5">
                <Button href="/posts" size="lg">
                  {t("browsePosts")}
                </Button>
                <WriteCta />
              </div>
            </div>

            <div className="hero-code-window animate-fade-in overflow-hidden" aria-hidden="true">
              <div className="row-sm border-b border-stroke px-5 py-3.5 hero-titlebar">
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-close" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-minimize" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-maximize" />
                <span className="ml-auto font-mono text-(length:--type-2xs) tracking-[0.02em] text-muted">
                  middleware/authGuard.ts
                </span>
              </div>

              <pre className="m-0 overflow-x-auto px-6 py-5 font-mono text-(length:--type-xs) leading-loose text-body max-md:px-4 max-md:py-4">
                <code className="bg-none font-[inherit]">
                  <span className="tok-comment">{t("codeComment")}</span>
                  {"\n"}
                  <span className="tok-key">export const</span>{" "}
                  <span className="tok-fn">authGuard</span> <span className="tok-punct">=</span>{" "}
                  <span className="tok-key">async</span> <span className="tok-punct">(</span>
                  {"\n  "}
                  <span className="tok-fn">req</span>
                  <span className="tok-punct">:</span> <span className="tok-type">Request</span>
                  <span className="tok-punct">,</span>
                  {"\n  "}
                  <span className="tok-fn">next</span>
                  <span className="tok-punct">:</span>{" "}
                  <span className="tok-type">NextFunction</span>
                  <span className="tok-punct">,</span>
                  {"\n"}
                  <span className="tok-punct">{") => {"}</span>
                  {"\n  "}
                  <span className="tok-fn">req</span>
                  <span className="tok-punct">.</span>
                  <span className="tok-fn">user</span> <span className="tok-punct">=</span>{" "}
                  <span className="tok-key">await</span> <span className="tok-fn">verifyToken</span>
                  <span className="tok-punct">(</span>
                  {"\n    "}
                  <span className="tok-fn">req</span>
                  <span className="tok-punct">.</span>
                  <span className="tok-fn">cookies</span>
                  <span className="tok-punct">.</span>
                  <span className="tok-fn">auth_token</span>
                  {"\n  "}
                  <span className="tok-punct">);</span>
                  {"\n  "}
                  <span className="tok-fn">next</span>
                  <span className="tok-punct">();</span>
                  {"\n"}
                  <span className="tok-punct">{"};"}</span>
                </code>
              </pre>
            </div>
          </div>
        </Container>
      </section>

      {/* 数据加载失败：降级为错误空态，提供刷新重试 */}
      {postsLoadError ? (
        <section className="animate-fade-in page-section" aria-label={t("latestSection")}>
          <Container>
            <div className="page-header">
              <h2 className="section-title">{t("latestTitle")}</h2>
            </div>

            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={t("loadErrorTitle")}
              description={t("loadErrorDesc")}
              action={
                <Button onClick={() => window.location.reload()}>{tCommon("refresh")}</Button>
              }
            />
          </Container>
        </section>
      ) : (
        // 有文章才渲染最新列表区块，空数据时首页仅保留 Hero
        hasPosts && (
          <section className="animate-fade-in page-section" aria-label={t("latestSection")}>
            <Container>
              <div className="page-header flex items-end justify-between gap-4">
                <div>
                  <h2 className="section-title">{t("latestTitle")}</h2>
                  <p className="mt-2 text-(length:--type-xs) leading-normal text-muted">
                    {t("latestSubtitle")}
                  </p>
                </div>
                <Button href="/posts" variant="ghost" size="sm">
                  {hasMore ? t("viewAllCount", { count: postsData?.total ?? "" }) : t("viewAll")}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((p, i) => (
                  <ArticleCard
                    key={p.id}
                    post={p}
                    href={postPath(p.id)}
                    tags={p.tags}
                    badge={p.pinned ? <PinnedBadge /> : undefined}
                    variant="vertical"
                    priority={i === 0}
                  />
                ))}
              </div>
            </Container>
          </section>
        )
      )}
    </>
  );
}
