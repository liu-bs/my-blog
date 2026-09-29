/**
 * @file Container.tsx
 * @description 页面内容宽度容器，统一全站的最大宽度与左右留白，保证各页面版心对齐
 */
import type { ContainerProps } from "@shared";

/**
 * Container 版心容器
 * @param props {@link ContainerProps}，className 会追加到容器上，用于覆写间距等
 * @returns 居中且带响应式左右内边距的 div 包裹层
 * @example
 * <Container className="page-section">{children}</Container>
 */
export function Container({ children, className = "" }: ContainerProps) {
  return <div className={`container mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
