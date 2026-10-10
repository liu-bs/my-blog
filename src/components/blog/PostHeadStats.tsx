"use client";

import { Eye, Heart, MessageCircle } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { formatCount } from "@shared/format";
import { usePostState } from "./PostStateProvider";

export function PostHeadStats() {
  const { post } = usePostState();
  return (
    <div className="ml-auto row-md text-(length:--type-xs) leading-normal text-muted">

      <span className="row-xs" aria-label={`${messages.post.views} ${formatCount(post.views)}`}>
        <Eye size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.views)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

      <span className="row-xs" aria-label={`${messages.post.likes} ${formatCount(post.likes)}`}>
        <Heart size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.likes)}
      </span>

      <span className="meta-dot" aria-hidden="true" />

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
