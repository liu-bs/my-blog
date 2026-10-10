/**
 * @file Avatar.tsx
 * @description 用户头像组件，支持图片头像（next/image 渲染）与文字缩写兜底头像（渐变背景 + initials）；
 * 提供 xs/sm/md/lg/xl 五档尺寸，用于导航栏用户菜单、评论区、文章页作者信息等场景
 */
import Image from "next/image";
import { isOptimizableImageSrc } from "@/lib/url";
import type { AvatarProps, AvatarSize } from "@shared";

/** 头像尺寸档位到容器样式类与渲染像素边长的映射（px 用于 Image 的宽高） */
const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  xs: { container: "h-5 w-5", text: "text-(length:--type-3xs) leading-none", px: 20 },
  sm: { container: "h-7 w-7", text: "text-(length:--type-2xs) leading-none", px: 28 },
  md: { container: "h-9 w-9", text: "text-(length:--type-xs) leading-none", px: 36 },
  lg: { container: "h-10 w-10", text: "text-(length:--type-sm) leading-none", px: 40 },
  xl: { container: "h-16 w-16", text: "text-(length:--type-lg) leading-none", px: 64 },
};

/**
 * 用户头像组件
 * @param props.initials 文字兜底头像显示的缩写（无 src 时使用）
 * @param props.size 头像尺寸档位，默认 md {@link AvatarSize}
 * @param props.src 图片头像地址，有值时渲染 next/image
 * @param props.alt 图片替代文本，无 src 时忽略
 * @param props.className 追加到根元素的自定义类名
 */
export function Avatar({ initials, size = "md", src, alt, className = "" }: AvatarProps) {
  /* 图片头像分支：有 src 时走 next/image，宽高取当前尺寸档的 px 值 */
  if (src) {
    const { container, px } = sizeMap[size];
    return (
      <Image
        src={src}
        alt={alt || ""}
        width={px}
        height={px}
        unoptimized={!isOptimizableImageSrc(src)}
        className={`${container} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  /* 文字缩写兜底分支：无 src 时渲染渐变圆形背景 + initials */
  return (
    <span
      className={`${sizeMap[size].container} ${sizeMap[size].text} flex shrink-0 items-center justify-center rounded-full avatar-gradient font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}
