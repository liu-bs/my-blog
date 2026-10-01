/**
 * @file Avatar.tsx
 * @description 头像组件：传入 src 时用 next/image 渲染图片头像，否则渲染 initials 文字头像（渐变圆形底）；xs~xl 五种尺寸
 */
import Image from "next/image";
import type { AvatarProps, AvatarSize } from "@shared";

/** 尺寸 → 容器/文字样式类与图片像素尺寸映射 */
const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  xs: { container: "h-5 w-5", text: "text-(length:--type-3xs) leading-none", px: 20 },
  sm: { container: "h-7 w-7", text: "text-(length:--type-2xs) leading-none", px: 28 },
  md: { container: "h-9 w-9", text: "text-(length:--type-xs) leading-none", px: 36 },
  lg: { container: "h-10 w-10", text: "text-(length:--type-sm) leading-none", px: 40 },
  xl: { container: "h-16 w-16", text: "text-(length:--type-lg) leading-none", px: 64 },
};

/**
 * Avatar 头像
 * @description 有 src 优先渲染图片头像，否则回退 initials 渐变文字头像
 * @param props {@link AvatarProps} 图片地址、首字母缩写、尺寸等
 */
export function Avatar({ initials, size = "md", src, alt, className = "" }: AvatarProps) {
  // 有图片地址：渲染 next/image 图片头像
  if (src) {
    const { container, px } = sizeMap[size];
    return (
      <Image
        src={src}
        alt={alt || ""}
        width={px}
        height={px}
        className={`${container} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeMap[size].container} ${sizeMap[size].text} flex shrink-0 items-center justify-center rounded-full avatar-gradient font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}
