/**
 * @file page.tsx
 * @description 博客首页（根路由 /），Server Component：服务端经缓存层拉取第一页
 * 最新文章（带一次数据库重试），渲染 Hero 区与最新文章列表；公开页面无需登录。
 * metadata 标题取 Hero 主标题拼接站点名，并通过 pageAlternates 输出多语言/分页 alternate 链接。
 */
import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinnedBadge } from "@/components/ui/PinnedBadge";
import { WriteCta } from "@/components/blog/WriteCta";
import { formatTemplate, messages } from "@/texts";
import { listPostsServer, withDbRetry } from "@server/blog/blog.cache";
import { postPath } from "@shared";
import { HOME_PAGE_SIZE } from "@/config/site";
import { pageAlternates } from "@/lib/seo";

/**
 * 生成首页 SEO metadata：标题去掉 Hero 主标题换行后拼接站点名，描述取 Hero 引导语
 */
export function generateMetadata() {
  return {
    title: `${messages.home.heroTitle.replace("\n", "")} · ${messages.meta.siteTitle}`,
    description: messages.home.heroLead,
    alternates: pageAlternates("/"),
  };
}

/**
 * 首页：Hero 展示区 + 最新文章列表（失败时降级为空态）
 */
export default async function HomePage() {
  // 拉取第一页公开文章：withDbRetry 失败后延迟重试一次，仍失败则整体置 null
  const postsData = await withDbRetry(() =>
    listPostsServer({ page: 1, limit: HOME_PAGE_SIZE }),
  ).catch(() => null);

  const latestPosts = postsData?.posts ?? [];

  // postsData 为 null 表示两次加载均失败，展示加载错误空态而非报错页
  const postsLoadError = postsData === null;

  // 总数大于本页数量则还有下一页，「查看全部」按钮显示带总数的文案
  const hasMore = (postsData?.total ?? 0) > latestPosts.length;

  const hasPosts = latestPosts.length > 0;

  return (
    <>
      {/* Hero 区：左侧标题/引导语/操作按钮，右侧装饰性代码窗口，逐层 fade-in 动画 */}
      <section className="hero-section" aria-label={messages.home.heroSection}>
        <Container>
          <div className="grid grid-cols-1 items-center gap-(--space-10) max-lg:gap-10 lg:grid-cols-[1fr_480px]">
            {/* Hero 左侧文案与操作区 */}
            <div className="max-w-152 max-lg:max-w-none">
              {/* 呼吸圆点 + 眉题小字 */}
              <div className="m-0 mb-8 row-sm flex animate-fade-in">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 animate-breathing rounded-full hero-dot"
                  aria-hidden="true"
                />
                <span className="text-(length:--type-xs) font-medium tracking-[0.02em] text-muted">
                  {messages.home.heroKicker}
                </span>
              </div>

              {/* 主标题：whitespace-pre-line 保留文案中的换行 */}
              <h1 className="m-0 mb-8 animate-fade-in [animation-delay:120ms]">
                <span className="hero-headline whitespace-pre-line text-heading">
                  {messages.home.heroTitle}
                </span>
              </h1>

              {/* 引导语副文案 */}
              <p className="m-0 mb-10 animate-fade-in hero-lead text-body [animation-delay:240ms]">
                {messages.home.heroLead}
              </p>

              {/* 操作按钮组：浏览全部文章 + 写作 CTA */}
              <div className="flex animate-fade-in flex-wrap items-center gap-5 border-t border-stroke pt-8 [animation-delay:360ms]">
                <Button href="/posts" size="lg">
                  {messages.home.browsePosts}
                </Button>
                <WriteCta />
              </div>
            </div>

            {/* Hero 右侧装饰性「代码窗口」，模拟编辑器外观，对辅助技术隐藏 */}
            <div
              className="hero-code-window animate-fade-in overflow-hidden [animation-delay:500ms]"
              aria-hidden="true"
            >
              {/* 窗口标题栏：红黄绿圆点 + 文件名 */}
              <div className="row-sm border-b border-stroke px-5 py-3.5 hero-titlebar">
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-close" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-minimize" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-maximize" />
                <span className="ml-auto font-mono text-(length:--type-2xs) tracking-[0.02em] text-muted">
                  手记/十月傍晚.md
                </span>
              </div>

              {/* 窗口正文：固定示例 Markdown 文本，非真实文章数据 */}
              <pre className="m-0 overflow-x-auto px-6 py-5 font-mono text-(length:--type-xs) leading-loose text-body max-md:px-4 max-md:py-4">
                <code className="bg-none font-[inherit]">
                  <span className="tok-key"># 傍晚六点半</span>
                  {"\n\n"}
                  沿河走了很久，风把白天的燥热都吹散了。
                  {"\n\n"}
                  读到一句：
                  {"\n"}
                  <span className="tok-comment">「地图是真实的，旅行才是想象的。」</span>
                  {"\n\n"}
                  明天想去旧书店，随便翻翻。
                </code>
              </pre>
            </div>
          </div>
        </Container>
      </section>

      {/* 最新文章区：加载失败显示错误空态+刷新按钮；有文章渲染卡片网格；无文章则整区隐藏 */}
      {postsLoadError ? (
        <section className="animate-fade-in page-section" aria-label={messages.home.latestSection}>
          <Container>
            <div className="page-header">
              <h2 className="section-title">{messages.home.latestTitle}</h2>
            </div>

            {/* 加载失败空态：客户端刷新按钮直接 reload */}
            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={messages.home.loadErrorTitle}
              description={messages.home.loadErrorDesc}
              action={
                <Button onClick={() => window.location.reload()}>{messages.common.refresh}</Button>
              }
            />
          </Container>
        </section>
      ) : (
        hasPosts && (
          <section
            className="animate-fade-in page-section"
            aria-label={messages.home.latestSection}
          >
            <Container>
              {/* 区块头：标题+副标题，右侧「查看全部」按钮（有更多时显示总数） */}
              <div className="page-header flex items-end justify-between gap-4">
                <div>
                  <h2 className="section-title">{messages.home.latestTitle}</h2>
                  <p className="mt-2 text-(length:--type-xs) leading-normal text-muted">
                    {messages.home.latestSubtitle}
                  </p>
                </div>
                <Button href="/posts" variant="ghost" size="sm">
                  {hasMore
                    ? formatTemplate(messages.home.viewAllCount, { count: postsData?.total ?? "" })
                    : messages.home.viewAll}
                </Button>
              </div>

              {/* 文章卡片网格：竖版样式；置顶文章加 PinnedBadge；前 3 张优先加载封面图 */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((p, i) => (
                  <ArticleCard
                    key={p.id}
                    post={p}
                    href={postPath(p.id)}
                    tags={p.tags}
                    badge={p.pinned ? <PinnedBadge /> : undefined}
                    variant="vertical"
                    priority={i < 3}
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
