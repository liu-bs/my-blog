/**
 * @file CoverFallback.tsx
 * @description 文章封面兜底组件，以 16:10 占位块 + 图片图标替代缺失或加载失败的封面图，用于文章卡片列表
 */
import { ImageIcon } from "lucide-react";
import type { CoverFallbackProps } from "@shared";

/**
 * 封面占位兜底块
 * @param props.className 追加到根元素的自定义类名
 */
export function CoverFallback({ className = "" }: CoverFallbackProps) {
  return (
    /* 16:10 aspect 占位容器，与文章卡片封面区高度比例一致 */
    <div
      className={`flex aspect-16/10 w-full items-center justify-center rounded-md text-muted cover-fallback ${className}`}
    >
      {/* 图片图标，纯装饰，对读屏隐藏 */}
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
}
