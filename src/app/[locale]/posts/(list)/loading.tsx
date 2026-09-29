/**
 * @file posts/(list)/loading.tsx
 * @description 文章列表段的路由级 Suspense 骨架：列表页数据未就绪时由 Next.js 自动渲染，占位结构由 PostsListSkeleton 提供
 */
import { PostsListSkeleton } from "@/components/skeletons/PostsListSkeleton";

/**
 * 列表页加载骨架
 * @description 作为 posts/(list)/page.tsx 在流式渲染期间的 fallback，保持与真实列表一致的布局以减少内容跳动
 * @returns 列表骨架组件
 */
export default function Loading() {
  return <PostsListSkeleton />;
}
