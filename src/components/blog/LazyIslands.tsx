/**
 * @file LazyIslands.tsx
 * @description 懒加载"岛屿"组件集合：通过 next/dynamic 将交互密集的 CommentsSection、BackToTop
 * 拆分为客户端懒加载组件，并用 IntersectionObserver 在评论区接近视口时才挂载完整交互版本，
 * 未进入视口前仅渲染只读评论预览（CommentsPreview），降低文章页首屏 JS 与请求开销。
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { messages } from "@/texts";
import type { CommentsListData, CommentsSectionProps } from "@shared";
import { CommentCardView } from "@/components/blog/CommentCardView";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

// 评论区完整交互版本（含发布/编辑/删除），关闭 SSR，加载中渲染骨架屏
const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

// 返回顶部悬浮按钮，关闭 SSR（依赖 window 滚动事件）
const BackToTop = dynamic(() => import("@/components/blog/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

/**
 * 评论区只读预览：仅展示标题、总数与评论卡片列表，无交互
 * @param data 服务端已拉取的评论首页数据，为空时渲染骨架屏
 */
function CommentsPreview({ data }: { data: CommentsListData | null }) {
  if (!data || data.comments.length === 0) return <CommentsSkeleton />;

  return (
    <section className="mt-10 mb-12">
      {/* 评论区标题 + 评论总数 */}
      <h2 className="mb-6 section-title">
        {messages.post.commentsTitle}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {data.total}
        </span>
      </h2>

      {/* 只读评论卡片列表 */}
      <div className="card-list">
        {data.comments.map((c) => (
          <CommentCardView key={c.id} comment={c} />
        ))}
      </div>
    </section>
  );
}

/**
 * 懒加载评论区：锚点接近视口（提前 200px）前渲染只读预览，进入后挂载完整交互组件
 * @param props {@link CommentsSectionProps}，initialData 为服务端预取的评论首页数据
 */
export function LazyComments({ initialData = null, ...props }: CommentsSectionProps) {
  /** 评论区锚点容器Ref，用于 IntersectionObserver 观察 */
  const anchorRef = useRef<HTMLDivElement>(null);

  /** 是否已进入视口（进入后挂载完整组件并停止观察） */
  const [visible, setVisible] = useState(false);

  /**
   * 建立 IntersectionObserver 监听锚点；环境不支持时直接挂载完整组件。
   * 依赖 visible：一旦可见即 disconnect，不再重复观察。
   */
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || visible) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={anchorRef}>
      {/* 进入视口后切换为完整交互评论区，否则保持只读预览 */}
      {visible ? (
        <CommentsSection {...props} initialData={initialData} />
      ) : (
        <CommentsPreview data={initialData} />
      )}
    </div>
  );
}

/**
 * 懒加载返回顶部按钮：仅作为动态导入的导出包装
 */
export function LazyBackToTop() {
  return <BackToTop />;
}
