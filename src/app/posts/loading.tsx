/**
 * @file loading.tsx
 * @description 文章列表页路由级加载态（/posts），在页面数据解析期间展示骨架屏；
 * Next.js 以 Suspense 边界包裹它，实现流式渲染时的占位。
 */
import { PostsListSkeleton } from "@/components/skeletons/PostsListSkeleton";

/**
 * 列表页加载骨架
 */
export default function Loading() {
  return <PostsListSkeleton />;
}
