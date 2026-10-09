/**
 * @file ArticleCard.tsx
 * @description 文章卡片组件，展示封面、分类、标题、摘要、标签、作者/统计信息与操作区；
 * 支持 horizontal（横向）与 vertical（纵向）两种布局，整卡通过绝对定位 Link 实现点击跳转。
 * 已用 memo 包裹，列表页渲染大量卡片时避免无谓重渲染。
 */
import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Heart } from "lucide-react";
import { messages } from "@/texts";
import { CoverFallback } from "@/components/ui/CoverFallback";
import { Avatar } from "@/components/ui/Avatar";
import { Tag, tagVariantFor } from "@/components/ui/Tag";
import { formatCount, formatDate, getInitials } from "@shared/format";

import { stripHtml, stripMarkdown } from "@shared/markdown";
import type { ArticleCardProps } from "@shared";

/**
 * 文章卡片
 * @param props {@link ArticleCardProps} post 为文章数据，href 提供时整卡可点击跳转
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
  /** 是否为纵向（上图下文）布局 */
  const isVertical = variant === "vertical";

  // 封面区域：有 coverImage 时用 next/image 渲染，否则渲染占位兜底图
  const cover = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md ${
        isVertical ? "aspect-16/10 w-full" : coverWidth
      }`}
    >
      {/* 封面图，横向布局首屏卡片可传 priority 提升加载优先级 */}
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

  // 卡片主体内容：按 variant 切换纵向/横向两套排版
  const card = isVertical ? (
    <div className="flex h-full flex-col gap-4">
      {cover}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* 分类名称 + 外部传入的角标（如"置顶"） */}
        <div className="row-sm">
          <span className="text-(length:--type-2xs) leading-normal font-semibold tracking-[0.04em] text-heading">
            {post.category}
          </span>
          {badge}
        </div>

        {/* 文章标题，去除 Markdown 语法后最多显示两行 */}
        <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
          {stripMarkdown(post.title)}
        </h2>

        {/* 文章摘要，去除 HTML 标签后最多显示两行 */}
        <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body">
          {stripHtml(post.summary)}
        </p>

        {/* 元信息行：作者头像+昵称 · 发布日期（无发布时间则用创建时间） */}
        <div className="mt-auto flex items-center gap-2 meta-text">
          <span className="inline-flex items-center gap-1 truncate">
            <Avatar initials={getInitials(post.authorName ?? "", "")} size="xs" />
            {post.authorName}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{formatDate(post.publishedAt || post.createdAt)}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-4 sm:flex-row">
      {cover}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* 分类名称 + 外部传入的角标 */}
        <div className="row-sm">
          <span className="text-(length:--type-2xs) leading-normal font-semibold tracking-[0.04em] text-heading">
            {post.category}
          </span>
          {badge}
        </div>

        {/* 文章标题，去除 Markdown 语法后最多显示两行 */}
        <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
          {stripMarkdown(post.title)}
        </h2>

        {/* 文章摘要，桌面端最多显示三行 */}
        <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body sm:line-clamp-3">
          {stripHtml(post.summary)}
        </p>

        {/* 标签组，按标签名匹配颜色变体 */}
        {tags && tags.length > 0 && (
          <div className="relative z-(--z-raised) flex flex-wrap gap-2">
            {tags.map((t) => (
              <Tag key={t} variant={tagVariantFor(t)} size="sm">
                {t}
              </Tag>
            ))}
          </div>
        )}

        {/* 元信息行：作者 · 日期 · 浏览量 · 点赞数 · 外部追加的额外统计项 */}
        <div className="mt-auto row-sm flex-wrap meta-text">
          <span className="inline-flex items-center gap-2 truncate">
            <Avatar initials={getInitials(post.authorName ?? "", "")} size="xs" />
            {post.authorName}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{formatDate(post.publishedAt || post.createdAt)}</span>
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

          {/* 额外统计项（如收藏、评论数），由调用方传入图标与数值 */}
          {extraStats?.map((s, i) => (
            <span key={`stat-${i}`} className="row-xs">
              <span className="meta-dot" aria-hidden="true" />
              {s.icon}
              {formatCount(s.value)}
            </span>
          ))}
        </div>

        {/* 操作按钮区插槽（如编辑/删除按钮），需高于覆盖链接的层级 */}
        {actions && <div className="relative z-(--z-raised) mt-2 row-sm">{actions}</div>}

        {/* "阅读全文"引导文案 + 箭头图标，仅在有跳转链接时展示 */}
        {href && (
          <span className="mt-2 inline-flex items-center gap-1 text-(length:--type-2xs) font-semibold text-muted transition-colors duration-[var(--duration-fast)] group-hover:text-accent">
            {readMoreLabel ?? messages.common.readMore}
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

  /** 卡片外层样式：纵向布局内边距更小，并追加调用方 className */
  const baseClass = `group relative card card-hover ${isVertical ? "p-5" : "p-6"} ${className}`;

  return (
    <div className={baseClass}>
      {/* 覆盖整个卡片的透明链接层，实现整卡点击跳转到文章页 */}
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
