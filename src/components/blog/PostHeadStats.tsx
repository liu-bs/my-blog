/**
 * @file PostHeadStats.tsx
 * @description 文章头部统计条：从 PostStateProvider 读取文章数据展示浏览/点赞/评论数，
 *              乐观互动与浏览量预增后此处计数随之实时刷新
 */
"use client";

import { Eye, Heart, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCount } from "@/lib/format";
import { usePostState } from "./PostStateProvider";

/**
 * PostHeadStats 文章头部统计
 */
export function PostHeadStats() {
  const { post } = usePostState();
  const t = useTranslations("post");

  return (
    <div className="ml-auto row-md text-(length:--type-xs) leading-normal text-muted">
      <span className="row-xs" aria-label={`${t("views" as never)} ${formatCount(post.views)}`}>
        <Eye size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.views)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

      <span className="row-xs" aria-label={`${t("likes" as never)} ${formatCount(post.likes)}`}>
        <Heart size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.likes)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

      <span className="row-xs" aria-label={`${t("commentsCount", { count: post.commentsCount })}`}>
        <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.commentsCount)}
      </span>
    </div>
  );
}
