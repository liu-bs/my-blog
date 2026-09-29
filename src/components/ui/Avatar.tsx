/**
 * @file Avatar.tsx
 * @description 用户头像组件，有可用图片地址时渲染 next/image，否则降级为渐变底的文字头像
 */
import Image from "next/image";
import type { AvatarProps, AvatarSize } from "@shared";
import { isSafeImageUrl } from "@shared";

/** 各尺寸对应的容器/文字样式类与图片像素边长（px），需保持宽高一致以避免布局抖动 */
const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  xs: { container: "h-5 w-5", text: "text-(length:--type-3xs) leading-none", px: 20 },
  sm: { container: "h-7 w-7", text: "text-(length:--type-2xs) leading-none", px: 28 },
  md: { container: "h-9 w-9", text: "text-(length:--type-xs) leading-none", px: 36 },
  lg: { container: "h-10 w-10", text: "text-(length:--type-sm) leading-none", px: 40 },
  xl: { container: "h-16 w-16", text: "text-(length:--type-lg) leading-none", px: 64 },
};

/**
 * Avatar 用户头像
 * @param props {@link AvatarProps}
 * @returns 图片可用时返回 next/image，否则返回展示 initials 的文字头像
 * @warning src 会先经 isSafeImageUrl 白名单校验，非法地址直接走文字兜底，避免渲染外部不可信资源
 */
export function Avatar({ initials, size = "md", src, alt, className = "" }: AvatarProps) {
  if (src && isSafeImageUrl(src)) {
    const { container, px } = sizeMap[size];
    return (
      // referrerPolicy 置为 no-referrer，避免向第三方图床泄露本站地址
      <Image
        src={src}
        alt={alt || ""}
        width={px}
        height={px}
        referrerPolicy="no-referrer"
        className={`${container} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  // 无图或地址不合法时的文字兜底，用 initials 占位保证头像区不塌陷
  return (
    <span
      className={`${sizeMap[size].container} ${sizeMap[size].text} flex shrink-0 items-center justify-center rounded-full avatar-gradient font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}
