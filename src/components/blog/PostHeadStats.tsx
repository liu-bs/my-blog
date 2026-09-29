/**
 * @file PostHeadStats.tsx
 * @description 文章头部右侧的浏览量 / 点赞数 / 评论数统计条，纯展示无交互；
 * 数据取自客户端 PostStateProvider 共享的文章状态，因此点赞后计数能即时刷新，而无需重新请求详情
 */
"use client";

import { Eye, Heart, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCount } from "@/lib/format";
import { usePostState } from "./PostStateProvider";

/**
 * PostHeadStats 文章头部统计
 * @description 顺序渲染「浏览 / 点赞 / 评论」三项计数，项间用 meta-dot 分隔；
 * 浏览量由 Provider 挂载时自增，点赞数由 PostActions 乐观更新回写，故这里始终保持与服务端最终值一致
 * @returns 统计条 JSX；aria-label 拼接了完整语义，图标仅作视觉装饰（aria-hidden）
 */
export function PostHeadStats() {
  /** 共享文章状态；只读用 post，本组件不触发任何更新 */
  const { post } = usePostState();
  const t = useTranslations("post");

  return (
    <div className="ml-auto row-md text-(length:--type-xs) leading-normal text-muted">
      {/* 浏览量：数字经 formatCount 转为带单位的紧凑形式，aria-label 保留完整语义供读屏 */}
      <span className="row-xs" aria-label={`${t("views" as never)} ${formatCount(post.views)}`}>
        <Eye size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.views)}
      </span>
      {/* 计数之间的装饰性圆点分隔符，无文本语义 */}
      <span className="meta-dot" aria-hidden="true" />
      {/* 点赞数：数值受 PostActions 的点赞/取消点赞乐观更新影响 */}
      <span className="row-xs" aria-label={`${t("likes" as never)} ${formatCount(post.likes)}`}>
        <Heart size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.likes)}
      </span>
      {/* 计数之间的装饰性圆点分隔符，无文本语义 */}
      <span className="meta-dot" aria-hidden="true" />
      {/* 评论数：由评论区加载后回写，未加载时展示详情接口返回的初始值 */}
      <span className="row-xs" aria-label={`${t("commentsCount", { count: post.commentsCount })}`}>
        <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(post.commentsCount)}
      </span>
    </div>
  );
}
