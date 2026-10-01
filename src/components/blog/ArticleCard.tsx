/**
 * @file ArticleCard.tsx
 * @description 文章卡片组件，供文章列表页 / 首页 / 搜索结果复用；展示封面、分类、标题、摘要、作者、时间与浏览点赞统计，支持横向（左图右文）与纵向（上图下文）两种布局
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
 * @description 卡片内容全部取自 post：封面、分类、标题、摘要、作者、时间、浏览量、点赞数；
 *              外层用 memo 包裹，列表重渲染时仅当 props 变化才重新渲染。
 * @param props {@link ArticleCardProps}，variant 决定布局方向，href 决定整卡是否可点击跳转，tags/actions/extraStats/badge 为插槽
 * @returns 卡片元素；传入 href 时在内容之上覆盖一层透明链接层，实现点击整卡进入详情
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
  /** 当前语言，用于日期本地化格式化 */
  const locale = useLocale() as Locale;
  /** common 命名空间文案，用于分类与「阅读更多」的兜底文案 */
  const t = useTranslations("common");

  /** 分类展示名：内置分类走 i18n 文案，自定义分类原样展示 */
  const categoryLabel = isKnownCategory(post.category)
    ? t(CATEGORY_LABEL_KEYS[post.category])
    : post.category;

  /** 是否纵向布局，纵向时封面满宽、正文改为上下排布 */
  const isVertical = variant === "vertical";

  /** 封面区块：有封面地址渲染 next/image，否则降级为 CoverFallback 占位 */
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

  /** 卡片主体：按 variant 渲染纵向（上图下文）或横向（左图右文）两套结构 */
  const card = isVertical ? (
    <div className="flex h-full flex-col gap-4">
      {cover}
      {/* 纵向布局正文：分类与角标、标题、摘要、作者与时间 */}
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
      {/* 横向布局正文：分类与角标、标题、摘要、标签、统计与操作区 */}
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

        {/* 标签云：传入 tags 时覆盖文章自带标签；层级高于整卡透明链接以便点击 */}
        {tags && tags.length > 0 && (
          <div className="relative z-(--z-raised) flex flex-wrap gap-2">
            {tags.map((t) => (
              <Tag key={t} variant={tagVariantFor(t)} size="sm">
                {t}
              </Tag>
            ))}
          </div>
        )}

        {/* 元信息：作者、发布时间、浏览量、点赞数，以及上层追加的统计项 */}
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
          {/* 追加统计项：由上层传入图标与数值，紧随默认统计之后渲染 */}
          {extraStats?.map((s, i) => (
            <span key={`stat-${i}`} className="row-xs">
              <span className="meta-dot" aria-hidden="true" />
              {s.icon}
              {formatCount(s.value)}
            </span>
          ))}
        </div>

        {/* 操作区插槽：抬高层级避免被整卡透明链接层拦截点击 */}
        {actions && <div className="relative z-(--z-raised) mt-2 row-sm">{actions}</div>}

        {/* 显式「阅读更多」入口，仅在传入 href 时展示 */}
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

  /** 卡片外层类名：纵向内边距略小；hover 交互依赖全局 card / card-hover 类与 group 选择器 */
  const baseClass = `group relative card card-hover ${isVertical ? "p-5" : "p-6"} ${className}`;

  return (
    <div className={baseClass}>
      {/* 整卡点击层：透明链接铺满卡片，使任意位置可跳转；z-content 低于 tags/actions 的 z-raised */}
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
