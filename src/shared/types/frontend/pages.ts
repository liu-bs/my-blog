/**
 * @file pages.ts
 * @description 页面级组件的入参类型：全局 Provider 包装与 Next.js 错误边界（error.tsx）的 Props。
 */
import type { ReactNode } from "react";

/**
 * 全局 Provider 包装组件 Props
 */
export interface ProvidersProps {
  /** 被包裹的应用树 */
  children: ReactNode;
}

/**
 * ErrorBoundary（Next.js error.tsx）组件 Props
 */
export interface ErrorBoundaryProps {
  /** 抛出的错误对象；digest 为服务端错误的定位标识（可在服务端日志中检索），客户端错误时缺省 */
  error: Error & { digest?: string };

  /** 重试回调，触发重新渲染当前路由 */
  retry: () => void;
}
