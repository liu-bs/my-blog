import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PostCard } from "@/components/post/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinnedBadge } from "@/components/ui/PinnedBadge";
import { StartWritingButton } from "@/components/post/StartWritingButton";
import { formatTemplate, texts } from "@/texts";
import { withDbRetry } from "@server/common/db";
import { listPostsCached } from "@server/post/post.cache";
import { postPath } from "@shared";
import { HOME_PAGE_SIZE } from "@/config/site";
import { pageAlternates } from "@/lib/seo";

export function generateMetadata() {
  return {
    title: `${texts.home.heroTitle.replace("\n", "")} · ${texts.meta.siteTitle}`,
    description: texts.home.heroLead,
    alternates: pageAlternates("/"),
  };
}

export default async function HomePage() {
  const postsResult = await withDbRetry(() =>
    listPostsCached({ page: 1, limit: HOME_PAGE_SIZE }),
  ).catch(() => null);

  const latestPosts = postsResult?.posts ?? [];

  const postsLoadError = postsResult === null;

  const hasMore = (postsResult?.total ?? 0) > latestPosts.length;

  const hasPosts = latestPosts.length > 0;

  return (
    <>
      <section className="hero-section" aria-label={texts.home.heroSection}>
        <Container>
          <div className="grid grid-cols-1 items-center gap-(--space-10) max-lg:gap-10 lg:grid-cols-[1fr_480px]">
            <div className="max-w-152 max-lg:max-w-none">
              <div className="m-0 mb-8 row-sm flex animate-fade-in">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 animate-breathing rounded-full hero-dot"
                  aria-hidden="true"
                />
                <span className="text-(length:--type-xs) font-medium tracking-[0.02em] text-muted">
                  {texts.home.heroKicker}
                </span>
              </div>

              <h1 className="m-0 mb-8 animate-fade-in [animation-delay:120ms]">
                <span className="hero-headline whitespace-pre-line text-heading">
                  {texts.home.heroTitle}
                </span>
              </h1>

              <p className="m-0 mb-10 animate-fade-in hero-lead text-body [animation-delay:240ms]">
                {texts.home.heroLead}
              </p>

              <div className="flex animate-fade-in flex-wrap items-center gap-5 border-t border-stroke pt-8 [animation-delay:360ms]">
                <Button href="/posts" size="lg">
                  {texts.home.browsePosts}
                </Button>
                <StartWritingButton />
              </div>
            </div>

            <div
              className="hero-code-window animate-fade-in overflow-hidden [animation-delay:500ms]"
              aria-hidden="true"
            >
              <div className="row-sm border-b border-stroke px-5 py-3.5 hero-titlebar">
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-close" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-minimize" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-maximize" />
                <span className="ml-auto font-mono text-(length:--type-2xs) tracking-[0.02em] text-muted">
                  手记/十月傍晚.md
                </span>
              </div>

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

      {postsLoadError ? (
        <section className="animate-fade-in page-section" aria-label={texts.home.latestSection}>
          <Container>
            <div className="page-header">
              <h2 className="section-title">{texts.home.latestTitle}</h2>
            </div>

            <EmptyState
              icon={<Search size={20} strokeWidth={2.5} />}
              title={texts.home.loadErrorTitle}
              description={texts.home.loadErrorDesc}
              action={
                <Button onClick={() => window.location.reload()}>{texts.common.refresh}</Button>
              }
            />
          </Container>
        </section>
      ) : (
        hasPosts && (
          <section className="animate-fade-in page-section" aria-label={texts.home.latestSection}>
            <Container>
              <div className="page-header flex items-end justify-between gap-4">
                <div>
                  <h2 className="section-title">{texts.home.latestTitle}</h2>
                  <p className="mt-2 text-(length:--type-xs) leading-normal text-muted">
                    {texts.home.latestSubtitle}
                  </p>
                </div>
                <Button href="/posts" variant="ghost" size="sm">
                  {hasMore
                    ? formatTemplate(texts.home.viewAllCount, { count: postsResult?.total ?? "" })
                    : texts.home.viewAll}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    href={postPath(post.id)}
                    tags={post.tags}
                    badge={post.pinned ? <PinnedBadge /> : undefined}
                    variant="vertical"
                    priority={index < 3}
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
