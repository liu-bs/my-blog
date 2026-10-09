/**
 * @file Container.tsx
 * @description 页面内容容器组件，提供水平居中与响应式左右内边距，用于导航栏下方各页面的主体内容包裹
 */
import type { ContainerProps } from "@shared";

/**
 * 内容容器
 * @param props.children 容器内渲染的内容
 * @param props.className 追加到根元素的自定义类名
 */
export function Container({ children, className = "" }: ContainerProps) {
  return <div className={`container mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
