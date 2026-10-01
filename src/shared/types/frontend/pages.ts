/**
 * @file pages.ts
 * @description 页面级（App Router 边界）共享 Props 类型：全局 Providers 与错误边界。
 *              这两类组件被框架在特定时机调用，Props 由 Next.js 传入，组件自身不定义调用方。
 */
import type { ReactNode } from "react";

/**
 * 全局 Provider 组件 Props
 * @description 包裹整个应用，用于挂载主题、i18n 等全局上下文
 */
export interface ProvidersProps {
  /** 被包裹的应用子树 */
  children: ReactNode;
}

/**
 * 错误边界组件 Props
 * @description 由 App Router 的 error 边界注入，用于展示路由级错误
 */
export interface ErrorBoundaryProps {
  /** 抛出的错误对象；`digest` 是服务端错误的摘要哈希，用于与服务端日志关联排查，生产环境不暴露具体堆栈 */
  error: Error & { digest?: string };

  /** 重试回调；调用后框架会重新取数并重新渲染出错的路由段。Next 16.3 起 `retry` 稳定，优先于旧的 `reset`（后者仅重渲染、不重新取数） */
  retry: () => void;
}
