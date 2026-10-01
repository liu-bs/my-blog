/**
 * @file BackToTop.tsx
 * @description 返回顶部悬浮按钮：滚动超过 400px 后淡入显示（rAF 节流监听），
 *              点击平滑回顶；隐藏时移出 Tab 焦点序，尊重系统"减少动态效果"设置
 */
"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * BackToTop 返回顶部按钮
 */
export function BackToTop() {
  const t = useTranslations("common");

  /** 按钮可见性：滚动超过 400px 时展示 */
  const [visible, setVisible] = useState(false);

  /** rAF 节流滚动监听，驱动可见性切换 */
  useRafScroll((scrollY) => setVisible(scrollY > 400));

  return (
    <div
      className={`fixed bottom-6 left-6 z-(--z-sticky) transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth max-md:bottom-4 max-md:left-4 ${
        visible ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
      }`}
    >
      <button
        onClick={() =>
          window.scrollTo({
            top: 0,

            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          })
        }
        aria-label={t("backToTop")}
        tabIndex={visible ? 0 : -1}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-card-bg text-heading shadow-(--shadow-md) transition-[background-color,box-shadow] duration-[var(--duration-fast)] ease-smooth hover:bg-btn-hover-bg hover:shadow-(--shadow-lg) max-md:h-10 max-md:w-10"
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
