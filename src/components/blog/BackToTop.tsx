/**
 * @file BackToTop.tsx
 * @description 全局「回到顶部」浮动按钮；滚动超过阈值后出现，点击平滑滚回页首
 */
"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * BackToTop 回到顶部按钮
 * @description 固定在页面左下角，用 useRafScroll 做 requestAnimationFrame 节流的滚动监听，
 *              滚动距离超过 400px（阈值，约一屏多）时淡入显示，避免短页面干扰阅读；
 *              隐藏时同时置为不可点击且移出 Tab 焦点序列。
 * @returns 浮动按钮元素；aria-label 走 i18n，随语言切换
 */
export function BackToTop() {
  /** common 命名空间文案，用于按钮的无障碍标签 */
  const t = useTranslations("common");

  /** 是否达到滚动阈值，决定按钮显隐 */
  const [visible, setVisible] = useState(false);

  /** 滚动监听：仅在 scrollY 超过 400 像素时显示，回调由 useRafScroll 统一节流到动画帧 */
  useRafScroll((scrollY) => setVisible(scrollY > 400));

  return (
    <div
      className={`fixed bottom-6 left-6 z-(--z-sticky) transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth max-md:bottom-4 max-md:left-4 ${
        visible ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
      }`}
    >
      {/* 点击平滑滚动到页首；隐藏态置 tabIndex=-1 避免键盘聚焦到不可见元素 */}
      <button
        onClick={() =>
          window.scrollTo({
            top: 0,
            // JS 显式传入的 behavior 会覆盖 CSS scroll-behavior，故此处也需读 reduced-motion，否则关闭动画偏好的用户仍看到平滑滚动
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
