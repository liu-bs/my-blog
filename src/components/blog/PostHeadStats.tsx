/**
 * @file PostHeadStats.tsx
 * @description 文章页头部统计条：从 PostStateProvider 读取文章数据，展示浏览量、点赞数、评论数，
 * 依赖互动区/浏览上报的乐观更新实时变化。纯展示组件，无交互。
 */
"use client";

import { Eye, Heart, MessageCircle } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { formatCount } from "@shared/format";
import { usePostState } from "./PostStateProvider";

/**
 * 文章头部统计条（浏览 · 点赞 · 评论）
 */
export function PostHeadStats() {
  const { post } = usePostState();
  return (
    <div className="ml-auto row-md text-(length:--type-xs) leading-normal text-muted">
      {/* 浏览量，aria-label 供屏幕阅读器朗读 */}
      <span className="row-xs" aria-label={`${messages.post.views} ${formatCount(post.views)}`}>
        <Eye size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.views)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

      {/* 点赞数 */}
      <span className="row-xs" aria-label={`${messages.post.likes} ${formatCount(post.likes)}`}>
        <Heart size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.likes)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

      {/* 评论数 */}
      <span
        className="row-xs"
        aria-label={`${formatTemplate(messages.post.commentsCount, { count: post.commentsCount })}`}
      >
        <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.commentsCount)}
      </span>
    </div>
  );
}
