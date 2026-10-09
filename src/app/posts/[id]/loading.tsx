/**
 * @file loading.tsx
 * @description 文章详情页路由级加载态（/posts/[id]），数据解析期间展示详情页骨架屏；
 * 由 Next.js 以 Suspense 边界包裹，配合静态预渲染实现流式占位。
 */
import { PostDetailSkeleton } from "@/components/skeletons/PostDetailSkeleton";

/**
 * 详情页加载骨架
 */
export default function Loading() {
  return <PostDetailSkeleton />;
}
