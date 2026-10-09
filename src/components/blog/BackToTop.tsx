/**
 * @file BackToTop.tsx
 * @description 返回顶部悬浮按钮：监听滚动（rAF 节流），滚动超过 400px 后显示；
 * 点击平滑滚回页顶，用户开启"减少动态效果"时降级为瞬时滚动。仅通过 LazyIslands 懒加载引入。
 */
"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { messages } from "@/texts";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * 返回顶部悬浮按钮
 */
export function BackToTop() {
  /** 按钮是否可见（滚动超过阈值后显示） */
  const [visible, setVisible] = useState(false);

  // 基于 rAF 节流的滚动监听：滚动距离超过 400px 时显示按钮
  useRafScroll((scrollY) => setVisible(scrollY > 400));

  return (
    // 悬浮容器：固定在左下角，通过透明度+可见性过渡控制显隐
    <div
      className={`fixed bottom-6 left-6 z-(--z-sticky) transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth max-md:bottom-4 max-md:left-4 ${
        visible ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
      }`}
    >
      {/* 返回顶部按钮：隐藏时 tabIndex=-1 移出键盘可达序列 */}
      <button
        onClick={() =>
          window.scrollTo({
            top: 0,

            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          })
        }
        aria-label={messages.common.backToTop}
        tabIndex={visible ? 0 : -1}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-card-bg text-heading shadow-(--shadow-md) transition-[background-color,box-shadow] duration-[var(--duration-fast)] ease-smooth hover:bg-btn-hover-bg hover:shadow-(--shadow-lg) max-md:h-10 max-md:w-10"
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
