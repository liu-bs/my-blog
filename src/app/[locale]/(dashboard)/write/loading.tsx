/**
 * @file (dashboard)/write/loading.tsx
 * @description 写作页的路由级 Suspense 骨架：登录校验与编辑文章预取期间展示，占位结构由 WriteSkeleton 提供
 */
import { WriteSkeleton } from "@/components/skeletons/WriteSkeleton";

/**
 * 写作页加载骨架
 * @description 作为 (dashboard)/write/page.tsx 流式渲染期间的 fallback
 * @returns 编辑器骨架组件
 */
export default function Loading() {
  return <WriteSkeleton />;
}
