/**
 * @file LazyIslands.tsx
 * @description 文章页懒加载孤岛集合：评论区经 IntersectionObserver 在距视口 200px 时才动态加载（ssr:false），
 *              加载期间展示骨架屏；返回顶部按钮按需动态加载。延迟非首屏重客户端组件的 JS 下载
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CommentsSectionProps } from "@shared";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

/** 评论区孤岛：关闭 SSR，进入可视区前仅渲染骨架屏 */
const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

/** 返回顶部孤岛：关闭 SSR，滚动到页面下方时才加载 */
const BackToTop = dynamic(() => import("@/components/blog/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

/**
 * LazyComments 评论区懒加载入口
 * @description 渲染锚点 div，IntersectionObserver 检测到接近视口（rootMargin 200px）后
 *              置 visible 并断开监听，随后挂载真正的 CommentsSection；不支持 IntersectionObserver
 *              的环境直接降级为立即加载
 */
export function LazyComments(props: CommentsSectionProps) {
  /** 触发懒加载的锚点元素 */
  const anchorRef = useRef<HTMLDivElement>(null);

  /** 是否已触发加载（单次触发后不再监听） */
  const [visible, setVisible] = useState(false);

  /** 视口接近检测：命中即加载并断开监听；环境不支持时直接加载（降级） */
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
    <div ref={anchorRef}>{visible ? <CommentsSection {...props} /> : <CommentsSkeleton />}</div>
  );
}

/**
 * LazyBackToTop 返回顶部按钮懒加载包装
 */
export function LazyBackToTop() {
  return <BackToTop />;
}
