/**
 * @file loading.tsx
 * @description 文章详情页流式加载骨架屏，在文章数据就绪前展示占位结构
 */
import { PostDetailSkeleton } from "@/components/skeletons/PostDetailSkeleton";

export default function Loading() {
  return <PostDetailSkeleton />;
}
