/**
 * @file Spinner.tsx
 * @description 加载指示器（旋转圆环）组件，sm/md/lg 三种尺寸；纯装饰元素（aria-hidden），加载语义由外层 aria-busy 提供
 */
/** 尺寸 → 边框粗细与整体尺寸映射 */
const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-[2.5px]",

  lg: "h-8 w-8 border-2",
};

import type { SpinnerProps } from "@shared";

/**
 * Spinner 加载指示器
 * @param props {@link SpinnerProps} 尺寸与附加类名
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      className={`${sizeMap[size]} inline-block animate-spin rounded-full border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
