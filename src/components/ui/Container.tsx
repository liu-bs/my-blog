/**
 * @file Container.tsx
 * @description 页面内容横向容器：居中限宽并带响应式水平内边距，作为各页面的统一外层包裹
 */
import type { ContainerProps } from "@shared";

/**
 * Container 内容容器
 * @param props {@link ContainerProps} 子内容与附加类名
 */
export function Container({ children, className = "" }: ContainerProps) {
  return <div className={`container mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
