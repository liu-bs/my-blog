/**
 * @file posts/[id]/page.tsx
 * @description 文章详情页（Server Component，公开路由）。职责：
 * 1) 解析并解码 URL 中的文章 ID，支持「ID 被改名」的永久跳转与 404 兜底；
 * 2) 构建完整 SEO 元信息（canonical / hreflang / OpenGraph / Twitter）与结构化数据（Article、BreadcrumbList）；
 * 3) 并行获取正文与上下篇数据，正文走带缓存标签的数据读取，互动能力（点赞 / 收藏 / 浏览上报 / 评论）下沉为客户端岛屿。
 *
 * 草稿可见性：本页统一走匿名上下文（getPublicPostServer 不注入用户），而 getPost 的规则是「草稿仅作者可见」，
 * 因此草稿在此页一律按 404 处理、不会展示；作者查看自己的草稿应走 /write?id= 的编辑页。
 */
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import "@/app/styles/hljs-theme.css"; // 代码块高亮主题，供正文内的代码片段使用
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
 * 构建时预渲染的文章路径
 * @description 取首页前 STATIC_PARAMS_LIMIT 篇文章，与全部语言做笛卡尔积，供 SSG 预生成静态页；
 * 超出部分由运行时按需渲染（dynamicParams 默认开启）。
 * @returns 形如 { locale, id } 的参数数组；构建期数据库不可用时退化为每个语言一个 "placeholder"，
 * 保证构建不中断，真实文章改由首次访问时按需生成
 */
export async function generateStaticParams() {
  try {
    const data = await listPostsServer({ page: 1, limit: STATIC_PARAMS_LIMIT });

    // URL 中一律使用编码后的 ID，与页面路由段保持一致
    const params = data.posts.flatMap((p) =>
      routing.locales.map((locale) => ({
        locale,
        id: encodePostId(p.id),
      })),
    );
    if (params.length > 0) return params;
  } catch {}
  // 空数据与异常共用同一兜底：至少产出一个占位路径，避免整次构建失败
  return routing.locales.map((locale) => ({ locale, id: "placeholder" }));
}

/**
 * 处理文章 ID 被改名的历史链接
 * @description 旧 ID 能查到对应新 ID 时返回 308 永久跳转，让搜索引擎与用户书签平滑迁移；否则静默返回，交由调用方继续走 404
 * @param id 解码后的旧文章 ID
 * @param locale 当前语言，用于拼装带语言前缀的目标地址
 * @returns 跳转或正常返回（不返回具体值）
 */
async function redirectIfRenamed(id: string, locale: string): Promise<void> {
  const newId = await findRenamedPostId(id);
  if (!newId) return;
  permanentRedirect(`/${locale}${postPath(newId)}`);
}

/**
 * 生成文章详情页 SEO 元信息
 * @description 标题与描述分别经 stripMarkdown / stripHtml 清洗并截断到 160 字，避免把 Markdown 记号带进搜索结果；
 * canonical 与 languages 覆盖全部语言，便于多语言 SEO。文章不存在时先尝试改名跳转，仍失败则触发 404。
 * @param params 动态路由参数，id 为编码后的文章 ID
 * @returns Next.js Metadata
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
    await redirectIfRenamed(id, locale);
    notFound();
  }
  const { post } = metaResult;
  const cleanTitle = stripMarkdown(post.title);

  /** 描述优先取摘要，缺失时退化为正文前 160 个字符 */
  const description = stripHtml(post.summary || post.content).slice(0, 160);

  return {
    title: `${cleanTitle} · ${tMeta("siteTitle")}`,
    description,
    alternates: {
      canonical: `/${locale}${postPath(id)}`,

      // 同一文章的各语言版本互为 hreflang 备选
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}${postPath(id)}`])),
    },
    openGraph: {
      title: cleanTitle,
      description,
      type: "article",

      // 无封面图时不带 images 字段，避免产出指向空的 OG 图
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
 * 上一篇 / 下一篇导航
 * @description 服务端组件，作为详情页底部的阅读引导；两篇都不存在时整体不渲染（返回 null）
 * @param neighborPosts 相邻文章数据，null 表示获取失败
 * @returns 相邻文章导航 JSX 或 null
 */
async function NeighborPosts({ neighborPosts }: { neighborPosts: NeighborPostsData | null }) {
  const tPost = await getTranslations("post");

  const prevPost = neighborPosts?.prev ?? null;

  const nextPost = neighborPosts?.next ?? null;

  if (!prevPost && !nextPost) return null;

  return (
    <nav className="mt-10 mb-8 grid gap-4 sm:grid-cols-2">
      {/* 上一篇卡片；缺失时用空占位保持两列栅格对齐 */}
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
      {/* 下一篇卡片；同样缺失时留空占位 */}
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
 * 文章详情页
 * @description 性能取舍：上下篇请求在正文之前发出（Promise 提前启动），与正文读取并行，最后才 await，缩短关键路径；
 * 正文用 withDbRetry 包裹以抵抗数据库冷启动，而数据读取本身在 blog.cache 内带 "use cache" 缓存标签，
 * 使页面主体可被缓存复用；点赞、收藏、浏览量上报、评论区等依赖登录态的交互全部下沉为客户端岛屿，
 * 由 PostStateProvider 注入初始数据后在客户端补齐用户态。
 * @param params 动态路由参数，id 为编码后的文章 ID
 * @returns 文章详情页 JSX
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: rawId } = await params;
  assertLocale(locale);

  // 先解码 URL 段，兼容被重复编码的历史链接
  const id = decodePostId(rawId);

  // 先发起上下篇请求（失败静默为 null），让它与正文读取并行而不是串行
  const neighborsPromise = getNeighborPostsServer(id).catch(() => null);

  const postResult = await withDbRetry(() => getPublicPostServer(id));
  if (!postResult) {
    // 文章不存在：可能是 ID 被改名（跳转），否则 404
    await redirectIfRenamed(id, locale);
    notFound();
  }
  const { post } = postResult;

  const [t, tNav, tCommon] = await Promise.all([
    getTranslations("post"),
    getTranslations("nav"),
    getTranslations("common"),
  ]);

  const neighborPosts = await neighborsPromise;

  /** 作者名拆分为姓 / 名，供头像取首字母使用 */
  const { firstName, lastName } = splitName(post.authorName || "");

  const authorInitials = post.authorName ? getInitials(firstName, lastName) : "";

  // 分类存储的是中文枚举值，交给 i18n 映射为当前语言的展示文案
  const categoryLabel = getCategoryLabel(post.category, tCommon as (k: string) => string);

  return (
    <PostStateProvider
      // 客户端岛屿只消费计数字段；正文 HTML 已由下方 dangerouslySetInnerHTML 服务端注入，
      // 若整包传入会把正文（含渲染 HTML 与原始 Markdown 两份）序列化进 RSC 载荷，随文章长度膨胀
      initialPost={{ ...post, content: "", contentRaw: undefined }}
    >
      <Container className="page-section">
        <div className="grid grid-cols-1 gap-10 pb-12 max-lg:gap-0 max-lg:pb-8 lg:grid-cols-[1fr_220px]">
          <article>
            <BackLink />

            {/* 文章头部：分类、标题、摘要、作者与阅读信息 */}
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
                      {/* 优先展示发布时间，缺失则回退创建时间；阅读时长由正文估算 */}
                      {formatDate(post.publishedAt || post.createdAt, locale)} ·{" "}
                      {t("readingTime", { minutes: estimateReadingTime(post.content) })}
                    </span>
                  </div>
                </div>
                <PostHeadStats />
              </div>

              {/* 作者本人可见的编辑 / 删除入口，非作者或无登录态时客户端自行隐藏 */}
              <AuthorActions postId={post.id} authorId={post.authorId} />
            </header>

            {/* 封面图 */}
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

            {/* 正文区：id 供 PostToc 生成目录；content 已由服务端渲染为可信 HTML */}
            <div id="article-content" className="animate-fade-in">
              <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content }} />

              {/* 标签列表，点击跳转到列表页的标签筛选 */}
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

              {/* 点赞 / 收藏操作条；SSR 先按未登录渲染，客户端水合后按真实登录态修正 */}
              <PostActions user={null} />

              {/* 浏览上报：客户端挂载后异步累加浏览量（服务端会忽略草稿） */}
              <ViewReporter postId={post.id} />

              {/* 评论区按需懒加载（进入视口才拉取组件与数据），同样先以未登录态渲染 */}
              <LazyComments postId={post.id} user={null} postAuthorId={post.authorId} />
            </div>

            <NeighborPosts neighborPosts={neighborPosts} />
          </article>

          {/* 右侧目录：由客户端扫描正文标题生成，窄屏隐藏 */}
          <PostToc articleId="article-content" />
        </div>

        <LazyBackToTop />

        {/* 结构化数据：Article，便于搜索引擎生成富摘要；</script> 转义由末尾的 < 替换兜底 */}
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
              // 把 < 转成 \u003c，防止标题 / 摘要中出现 </script> 提前闭合脚本导致 XSS
            }).replace(/</g, "\\u003c"),
          }}
        />

        {/* 结构化数据：BreadcrumbList，层级为「首页 > 文章列表 > 当前文章」 */}
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
