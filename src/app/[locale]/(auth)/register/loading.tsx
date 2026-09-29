/**
 * @file (auth)/register/loading.tsx
 * @description 注册页的路由级 Suspense 骨架：注册页模块加载或服务端元信息生成期间展示，占位结构由 RegisterSkeleton 提供
 */
import { RegisterSkeleton } from "@/components/skeletons/RegisterSkeleton";

/**
 * 注册页加载骨架
 * @description 作为 (auth)/register/page.tsx 流式渲染期间的 fallback
 * @returns 注册表单骨架组件
 */
export default function Loading() {
  return <RegisterSkeleton />;
}
