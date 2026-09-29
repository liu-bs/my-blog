/**
 * @file LazyIslands.tsx
 * @description 文章详情页的「岛屿」延迟加载入口：把评论区与回到顶部按钮从服务端渲染路径中拆出，按需才加载
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CommentsSectionProps } from "@shared";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

/**
 * 评论区的动态导入（岛屿）
 * @description ssr:false 让评论区完全在客户端加载：它依赖登录态、乐观更新与大量交互，服务端渲染收益低，
 *              且会导致 detail 页 HTML 变大；加载期间用评论骨架屏占位，保持布局稳定避免 CLS。
 */
const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

/**
 * 回到顶部按钮的动态导入：与正文无关的全局浮层，单独成 chunk，不在首屏关键路径上
 */
const BackToTop = dynamic(() => import("@/components/blog/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

/**
 * LazyComments 延迟挂载的评论区
 * @description 在评论区位置放一个占位锚点，用 IntersectionObserver 监听其是否接近视口
 *              （rootMargin 200px 预留提前量），只有滚动到附近才真正挂载评论区组件并触发数据请求，
 *              从而避免首屏就发起评论列表请求、也避免执行评论区整段交互代码。
 * @param props {@link CommentsSectionProps}，原样透传给评论区
 * @returns 锚点容器；未进入视口时渲染评论骨架屏，进入后渲染真实评论区
 */
export function LazyComments(props: CommentsSectionProps) {
  /** 占位锚点，作为可见性观察目标 */
  const anchorRef = useRef<HTMLDivElement>(null);

  /** 锚点是否已进入（或接近）视口，为 true 时挂载真实评论区 */
  const [visible, setVisible] = useState(false);

  /**
   * 可见性观察：进入视口即置 visible 并断开观察（只需触发一次）
   * @description 环境不支持 IntersectionObserver 时直接置为可见，保证评论区始终可用；
   *              卸载或 visible 变化时通过 cleanup 断开 observer，防止泄漏。
   */
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || visible) return;

    /** 缺少 IntersectionObserver API 时降级为立即加载，避免功能缺失 */
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
    /* 锚点容器：未进入视口时用骨架屏占据位置，进入后替换为真实评论区 */
    <div ref={anchorRef}>{visible ? <CommentsSection {...props} /> : <CommentsSkeleton />}</div>
  );
}

/**
 * LazyBackToTop 回到顶部按钮的延迟加载包装
 * @description 仅做一层转发，目的是让调用方（server component 页面）无需直接引用客户端浮层组件
 * @returns 回到顶部按钮
 */
export function LazyBackToTop() {
  return <BackToTop />;
}
