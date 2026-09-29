/**
 * @file CoverFallback.tsx
 * @description 文章封面缺失或加载失败时的占位块，保持与封面一致的 16:10 比例以免布局跳动
 */
import { ImageIcon } from "lucide-react";
import type { CoverFallbackProps } from "@shared";

/**
 * CoverFallback 封面兜底占位
 * @param props {@link CoverFallbackProps}
 * @returns 固定宽高比的中性占位块，内部为装饰性 ImageIcon
 */
export function CoverFallback({ className = "" }: CoverFallbackProps) {
  return (
    <div
      className={`flex aspect-16/10 w-full items-center justify-center rounded-md text-muted cover-fallback ${className}`}
    >
      {/* 图标纯装饰，对辅助技术隐藏；占位语义由外层容器承担 */}
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
}
