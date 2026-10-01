/**
 * @file CoverFallback.tsx
 * @description 封面图兜底占位组件：文章无封面时渲染的 16:10 占位块，居中展示图片图标
 */
import { ImageIcon } from "lucide-react";
import type { CoverFallbackProps } from "@shared";

/**
 * CoverFallback 封面占位
 * @param props {@link CoverFallbackProps} 附加类名
 */
export function CoverFallback({ className = "" }: CoverFallbackProps) {
  return (
    <div
      className={`flex aspect-16/10 w-full items-center justify-center rounded-md text-muted cover-fallback ${className}`}
    >
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
}
