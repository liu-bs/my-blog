/**
 * @file page.tsx
 * @description 文章详情页（Server Component）：数据走 'use cache' 缓存函数（getPublicPostServer 等），
 *              外层包 withDbRetry 容忍数据库冷启动；文章不存在时先尝试改名校正再 notFound()。
 *              generateStaticParams 按 locale × 最新文章 id 预渲染，generateMetadata 处理
 *              canonical/hreflang/OG/robots（缺失文章 noindex），页面内注入 Article 与面包屑 JSON-LD，
 *              浏览量上报与评论列表交由客户端 island 懒加载
 */
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import "@/app/styles/hljs-theme.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getInitials, splitName } from "@/lib/format";
import { getCategoryLabel } from "@/lib/category";
import { estimateReadingTime, stripHtml, stripMarkdown } from "@/lib/markdown";
import { decodePostId, encodePostId, postPath } from "@shared";
import {
  getPublicPostServer,
  getNeighborPostsServer,
  listPostsServer,
  findRenamedPostId,
  withDbRetry,
} from "@server/blog/blog.cache";
import { SITE_URL, STATIC_PARAMS_LIMIT } from "@/config/site";
import { routing } from "@/i18n/routing";
import type { NeighborPostsData } from "@shared";
import { tagClassFor, tagVariantFor } from "@/components/ui/Tag";
import { PostActions } from "@/components/blog/PostActions";
import { PostHeadStats } from "@/components/blog/PostHeadStats";
import { PostToc } from "@/components/blog/PostToc";
import { AuthorActions } from "@/components/blog/AuthorActions";
import { ViewReporter } from "@/components/blog/ViewReporter";
import { LazyComments, LazyBackToTop } from "@/components/blog/LazyIslands";
import { PostStateProvider } from "@/components/blog/PostStateProvider";
import { BackLink } from "@/components/blog/BackLink";

/**
 * 预生成静态参数：取最新一批文章，与各 locale 做笛卡尔积；
 * 数据库不可用时兜底返回 placeholder id，保证构建不被阻塞（这些请求会在运行时回退渲染）
 */
export async function generateStaticParams() {
  try {
    const data = await listPostsServer({ page: 1, limit: STATIC_PARAMS_LIMIT });

    const params = data.posts.flatMap((p) =>
      routing.locales.map((locale) => ({
        locale,
        id: encodePostId(p.id),
      })),
    );
    if (params.length > 0) return params;
  } catch {}

  // 兜底参数：构建期拿不到文章列表时仍产出合法静态参数
  return routing.locales.map((locale) => ({ locale, id: "placeholder" }));
}

/**
 * 改名兼容跳转：若 id 对应文章已重命名，301 永久重定向到新地址
 * @param id 旧文章 id
 * @param locale 当前语言
 */
async function redirectIfRenamed(id: string, locale: string): Promise<void> {
  const newId = await findRenamedPostId(id);
  if (!newId) return;
  permanentRedirect(`/${locale}${postPath(newId)}`);
}

/**
 * 生成详情页元数据
 * @param params 路由参数，含 locale 与加密后的文章 id
 * @returns 文章存在时返回标题/摘要/OG/Twitter 与 canonical、hreflang；
 *          文章缺失时先尝试改名重定向，否则返回 robots noindex（PPR 流式下状态码只能是 200，
 *          需靠 noindex 阻止搜索引擎收录）
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id: rawId } = await params;
  assertLocale(locale);
  const id = decodePostId(rawId);
  const tMeta = await getTranslations("meta");
  const metaResult = await getPublicPostServer(id);
  if (!metaResult) {
    // 文章可能只是改了 slug/id：能校正则重定向，否则对爬虫声明不收录
    await redirectIfRenamed(id, locale);
    return {
      title: tMeta("siteTitle"),
      robots: { index: false, follow: false },
    };
  }
  const { post } = metaResult;
  const cleanTitle = stripMarkdown(post.title);

  // 描述兜底：无摘要时截取正文纯文本前 160 字符
  const description = stripHtml(post.summary || post.content).slice(0, 160);

  return {
    title: `${cleanTitle} · ${tMeta("siteTitle")}`,
    description,
    alternates: {
      canonical: `/${locale}${postPath(id)}`,

      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}${postPath(id)}`])),
    },
    openGraph: {
      title: cleanTitle,
      description,
      type: "article",

      ...(post.coverImage && { images: [{ url: post.coverImage, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description,
      ...(post.coverImage && { images: [post.coverImage] }),
    },
  };
}

/**
 * 上一篇/下一篇导航（Server Component）
 * @param neighborPosts 相邻文章数据，null 或两侧均缺失时不渲染
 */
async function NeighborPosts({ neighborPosts }: { neighborPosts: NeighborPostsData | null }) {
  const tPost = await getTranslations("post");

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
            {tPost("prevPost")}
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
            {tPost("nextPost")}
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

/**
 * 文章详情页组件
 * @param params 路由参数，含 locale 与加密后的文章 id
 * @returns 详情页：文章头部/正文/标签/作者操作区/相邻文章导航/目录，注入 JSON-LD 结构化数据；
 *           文章不存在时先尝试改名重定向，仍无则渲染 404
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: rawId } = await params;
  assertLocale(locale);

  const id = decodePostId(rawId);

  // 相邻文章查询与主查询并行发起，失败（含文章不存在）时静默降级为 null
  const neighborsPromise = getNeighborPostsServer(id).catch(() => null);

  // 主查询：'use cache' 缓存函数外包 withDbRetry，容忍数据库冷启动
  const postResult = await withDbRetry(() => getPublicPostServer(id));
  if (!postResult) {
    // 文章缺失：优先尝试改名校正重定向，否则渲染 404
    await redirectIfRenamed(id, locale);
    notFound();
  }
  const { post } = postResult;

  const [t, tNav, tCommon] = await Promise.all([
    getTranslations("post"),
    getTranslations("nav"),
    getTranslations("common"),
  ]);

  // 等待并行发起的相邻文章查询结果
  const neighborPosts = await neighborsPromise;

  const { firstName, lastName } = splitName(post.authorName || "");

  const authorInitials = post.authorName ? getInitials(firstName, lastName) : "";

  const categoryLabel = getCategoryLabel(post.category, tCommon as (k: string) => string);

  // 下发给客户端的初始数据剥离正文：正文仅保留在服务端渲染的 HTML 中，避免重复传输
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
                      {formatDate(post.publishedAt || post.createdAt, locale)} ·{" "}
                      {t("readingTime", { minutes: estimateReadingTime(post.content) })}
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
                priority
                className="mb-10 aspect-21/9 w-full animate-fade-in rounded-2xl object-cover max-md:aspect-16/9"
              />
            )}

            <div id="article-content" className="animate-fade-in">
              <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content }} />

              {post.tags?.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-stroke pt-8">
                  {post.tags.map((t) => (
                    <Link
                      key={t}
                      href={`/posts?tag=${encodeURIComponent(t)}`}
                      className={`badge-lg ${tagClassFor[tagVariantFor(t)]}`}
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              )}

              <PostActions user={null} />

              {/* 互动 island：浏览量上报（POST /api/posts/[id]/view，服务端异步写库）与
                  评论懒加载（进入视口后经 GET /api/posts/[id]/comments 拉取） */}
              <ViewReporter postId={post.id} />

              <LazyComments postId={post.id} user={null} postAuthorId={post.authorId} />
            </div>

            <NeighborPosts neighborPosts={neighborPosts} />
          </article>

          <PostToc articleId="article-content" />
        </div>

        <LazyBackToTop />

        {/* Article 结构化数据：标题/摘要/发布与更新时间/作者/封面，`<` 转义防脚本注入 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
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

        {/* 面包屑结构化数据：首页 → 文章列表 → 当前文章 */}
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
                  name: tNav("home"),
                  item: `${SITE_URL}/${locale}`,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: tNav("posts"),
                  item: `${SITE_URL}/${locale}/posts`,
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
