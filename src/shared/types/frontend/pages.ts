/**
 * @file pages.ts
 * @description 页面级布局组件类型：全局 Providers 与错误边界的 Props
 */
import type { ReactNode } from "react";

/**
 * 全局 Providers 容器组件 Props（主题/认证/Toast 等上下文包裹）
 */
export interface ProvidersProps {
  /** 应用内容 */
  children: ReactNode;
}

/**
 * 错误边界组件 Props（Next.js error.tsx 约定）
 */
export interface ErrorBoundaryProps {
  /** 捕获到的错误对象，digest 为服务端日志关联 ID */
  error: Error & { digest?: string };

  /** 重试回调：尝试重新渲染出错的路由段 */
  retry: () => void;
}
