/**
 * @file ArticleCard.tsx
 * @description 文章卡片组件：支持水平/垂直两种布局，展示封面、分类、标题、摘要、标签、作者、日期、浏览/点赞数及自定义操作区；
 *              通过 memo 避免父级重渲染导致的重复绘制，外层整卡可点击跳转（覆盖式 Link + aria-label）
 */
import { memo } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Eye, Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CoverFallback } from "@/components/ui/CoverFallback";
import { Avatar } from "@/components/ui/Avatar";
import { Tag, tagVariantFor } from "@/components/ui/Tag";
import { formatCount, formatDate, getInitials } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { CATEGORY_LABEL_KEYS, isKnownCategory } from "@/lib/category";
import { stripHtml, stripMarkdown } from "@/lib/markdown";
import type { ArticleCardProps } from "@shared";

/**
 * ArticleCard 文章卡片
 * @description memo 包裹的纯展示组件，数据与交互均由 props 驱动；
 *              传入 href 时渲染覆盖整卡的链接层实现整卡可点
 */
export const ArticleCard = memo(function ArticleCard({
  post,
  href,
  readMoreLabel,
  badge,
  tags,
  actions,
  extraStats,
  coverWidth = "aspect-16/10 w-full sm:aspect-auto sm:w-50",
  className = "",
  variant = "horizontal",
  priority = false,
}: ArticleCardProps) {
  const locale = useLocale() as Locale;

  const t = useTranslations("common");

  /** 分类展示文案：已知分类走 i18n 词条，未知分类原样展示 */
  const categoryLabel = isKnownCategory(post.category)
    ? t(CATEGORY_LABEL_KEYS[post.category])
    : post.category;

  /** 是否垂直布局（卡片列表页使用，横向卡片用于文章页推荐位） */
  const isVertical = variant === "vertical";

  /** 封面区域：有封面走 next/image 优化器，无封面渲染占位组件 */
  const cover = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md ${
        isVertical ? "aspect-16/10 w-full" : coverWidth
      }`}
    >
      {post.coverImage ? (
        <Image
          src={post.coverImage}
          alt={post.title}
          fill
          priority={priority}
          sizes={isVertical ? "(max-width: 768px) 100vw, 400px" : "(max-width: 640px) 100vw, 200px"}
          className="aspect-16/10 w-full rounded-md object-cover transition-transform duration-[var(--duration-slow)] ease-smooth group-hover:scale-103"
        />
      ) : (
        <CoverFallback className={isVertical ? "aspect-16/10 w-full" : "sm:h-full"} />
      )}
    </div>
  );

  /** 卡片主体：标题/摘要渲染前剥离 Markdown 标记与 HTML 标签，防止原文符号泄漏到展示层 */
  const card = isVertical ? (
    <div className="flex h-full flex-col gap-4">
      {cover}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="row-sm">
          <span className="text-(length:--type-2xs) leading-normal font-semibold tracking-[0.04em] text-heading">
            {categoryLabel}
          </span>
          {badge}
        </div>

        <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
          {stripMarkdown(post.title)}
        </h2>

        <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body">
          {stripHtml(post.summary)}
        </p>

        <div className="mt-auto flex items-center gap-2 meta-text">
          <span className="inline-flex items-center gap-1 truncate">
            <Avatar initials={getInitials(post.authorName ?? "", "")} size="xs" />
            {post.authorName}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{formatDate(post.publishedAt || post.createdAt, locale)}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-4 sm:flex-row">
      {cover}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="row-sm">
          <span className="text-(length:--type-2xs) leading-normal font-semibold tracking-[0.04em] text-heading">
            {categoryLabel}
          </span>
          {badge}
        </div>

        <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
          {stripMarkdown(post.title)}
        </h2>

        <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body sm:line-clamp-3">
          {stripHtml(post.summary)}
        </p>

        {tags && tags.length > 0 && (
          <div className="relative z-(--z-raised) flex flex-wrap gap-2">
            {tags.map((t) => (
              <Tag key={t} variant={tagVariantFor(t)} size="sm">
                {t}
              </Tag>
            ))}
          </div>
        )}

        <div className="mt-auto row-sm flex-wrap meta-text">
          <span className="inline-flex items-center gap-2 truncate">
            <Avatar initials={getInitials(post.authorName ?? "", "")} size="xs" />
            {post.authorName}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{formatDate(post.publishedAt || post.createdAt, locale)}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span className="row-xs">
            <Eye size={12} strokeWidth={2.5} />
            {formatCount(post.views)}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span className="row-xs">
            <Heart size={12} strokeWidth={2.5} />
            {formatCount(post.likes)}
          </span>

          {extraStats?.map((s, i) => (
            <span key={`stat-${i}`} className="row-xs">
              <span className="meta-dot" aria-hidden="true" />
              {s.icon}
              {formatCount(s.value)}
            </span>
          ))}
        </div>

        {actions && <div className="relative z-(--z-raised) mt-2 row-sm">{actions}</div>}

        {href && (
          <span className="mt-2 inline-flex items-center gap-1 text-(length:--type-2xs) font-semibold text-muted transition-colors duration-[var(--duration-fast)] group-hover:text-accent">
            {readMoreLabel ?? t("readMore")}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-[var(--duration-fast)] ease-smooth group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );

  const baseClass = `group relative card card-hover ${isVertical ? "p-5" : "p-6"} ${className}`;

  return (
    <div className={baseClass}>
      {/* 传入 href 时渲染覆盖整卡的透明链接层，使整卡可点且保留子内容交互层级 */}
      {href && (
        <Link
          href={href}
          className="absolute inset-0 z-(--z-content) rounded-xl"
          aria-label={post.title}
        />
      )}
      {card}
    </div>
  );
});
