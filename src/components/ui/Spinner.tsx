/**
 * @file Spinner.tsx
 * @description 加载中旋转指示器，用边框缺口 + animate-spin 实现纯 CSS 圆圈动画；常嵌入 Button/SubmitButton 的 loading 态
 */
/** 尺寸档位到宽高与边框粗细类名的映射 */
const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-[2.5px]",

  lg: "h-8 w-8 border-2",
};

import type { SpinnerProps } from "@shared";

/**
 * 旋转加载指示器
 * @param props.size 尺寸档位，默认 md（sm/md/lg）
 * @param props.className 追加到根元素的自定义类名
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    /* 圆形边框元素，右边缘透明形成旋转缺口；aria-hidden 避免读屏播报装饰动画 */
    <span
      className={`${sizeMap[size]} inline-block animate-spin rounded-full border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
