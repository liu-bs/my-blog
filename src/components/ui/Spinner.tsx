/**
 * @file Spinner.tsx
 * @description 纯样式的加载转圈指示器，颜色继承 currentColor，便于在按钮/容器内直接复用
 */

/** size 到尺寸与描边粗细样式类的映射；lg 的 border-2 在更大直径下保持观感一致 */
const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-[2.5px]",

  lg: "h-8 w-8 border-2",
};

import type { SpinnerProps } from "@shared";

/**
 * Spinner 加载指示器
 * @param props {@link SpinnerProps}
 * @returns 旋转的圆环元素；自身带 aria-hidden，故调用方需通过 aria-busy 或文案表达加载态
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      className={`${sizeMap[size]} inline-block animate-spin rounded-full border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
