/**
 * @file posts/[id]/loading.tsx
 * @description 文章详情段的路由级 Suspense 骨架：详情页等待文章与相邻文章数据期间展示，占位结构由 PostDetailSkeleton 提供
 */
import { PostDetailSkeleton } from "@/components/skeletons/PostDetailSkeleton";

/**
 * 详情页加载骨架
 * @description 作为 posts/[id]/page.tsx 流式渲染期间的 fallback；仅覆盖详情段，列表段由其自身的 loading.tsx 负责
 * @returns 详情骨架组件
 */
export default function Loading() {
  return <PostDetailSkeleton />;
}
