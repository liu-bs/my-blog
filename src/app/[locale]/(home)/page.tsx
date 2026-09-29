/**
 * @file (home)/page.tsx
 * @description 首页（Server Component）。在服务端直接调用 blog 数据层拿最新文章，展示 Hero 与最新文章列表，并处理加载失败 / 空数据分支
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

/**
 * 生成首页 metadata
 * @description 标题取「heroKicker · 站点名」，描述取 heroLead；与根布局的 metadata 合并
 * @param params 路由参数，await 后得到 locale
 * @throws 非法 locale 由 assertLocale 触发 notFound
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);
  const [t, tMeta] = await Promise.all([getTranslations("home"), getTranslations("meta")]);
  return {
    title: `${t("heroKicker")} · ${tMeta("siteTitle")}`,
    description: t("heroLead"),
  };
}

/**
 * HomePage 首页
 * @description 数据获取走服务端直接调用 blog.cache 的 listPostsServer（内部带 "use cache" + cacheLife，不是 fetch），因此不会向前端暴露接口；首页只取第一页
 * @param params 路由参数，await 后得到 locale
 * @throws 非法 locale 由 assertLocale 触发 notFound
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  /** 校验并收窄 locale 类型，非法值 404 */
  assertLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations("home"), getTranslations("common")]);

  /** withDbRetry 对非业务类（数据库抖动）错误重试一次；仍失败则 catch 成 null，转为页面内的错误态而非整页崩溃 */
  const postsData = await withDbRetry(() =>
    listPostsServer({ page: 1, limit: HOME_PAGE_SIZE }),
  ).catch(() => null);

  const latestPosts = postsData?.posts ?? [];

  /** null 代表数据获取失败，用于渲染「加载失败」空态 */
  const postsLoadError = postsData === null;

  /** 总数大于本页条数说明还有更多，用于「查看全部」按钮文案 */
  const hasMore = (postsData?.total ?? 0) > latestPosts.length;

  /** 是否有关键内容可渲染；无文章时不渲染最新区块 */
  const hasPosts = latestPosts.length > 0;

  return (
    <>
      {/* Hero 区：左侧文案与 CTA，右侧装饰性代码窗口 */}
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

            {/* 装饰性代码窗口：纯展示（aria-hidden），语法高亮由 tok-* 类给出，文案来自翻译 */}
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

      {/* 数据获取失败：展示可重试的错误空态 */}
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
        hasPosts && (
          /* 正常分支：仅在有文章时渲染最新文章区块 */
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
              {/* 最新文章网格：props 均为可序列化的纯数据（post、字符串 href、tags），首屏第一张图用 priority 提前加载 */}
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
