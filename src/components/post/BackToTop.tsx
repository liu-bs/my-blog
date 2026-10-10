"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { texts } from "@/texts";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useThrottledScroll((scrollY) => setIsVisible(scrollY > 400));

  return (
    <div
      className={`fixed bottom-6 left-6 z-(--z-sticky) transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth max-md:bottom-4 max-md:left-4 ${
        isVisible ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
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
        aria-label={texts.common.backToTop}
        tabIndex={isVisible ? 0 : -1}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-card-bg text-heading shadow-(--shadow-md) transition-[background-color,box-shadow] duration-[var(--duration-fast)] ease-smooth hover:bg-btn-hover-bg hover:shadow-(--shadow-lg) max-md:h-10 max-md:w-10"
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
