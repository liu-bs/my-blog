/**
 * @file (auth)/login/loading.tsx
 * @description 登录页的路由级 Suspense 骨架：登录页模块加载或服务端元信息生成期间展示，占位结构由 LoginSkeleton 提供
 */
import { LoginSkeleton } from "@/components/skeletons/LoginSkeleton";

/**
 * 登录页加载骨架
 * @description 作为 (auth)/login/page.tsx 流式渲染期间的 fallback
 * @returns 登录表单骨架组件
 */
export default function Loading() {
  return <LoginSkeleton />;
}
