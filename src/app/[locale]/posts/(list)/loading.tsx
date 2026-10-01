/**
 * @file loading.tsx
 * @description 文章列表页流式加载骨架屏，在列表数据就绪前展示占位结构
 */
import { PostsListSkeleton } from "@/components/skeletons/PostsListSkeleton";

export default function Loading() {
  return <PostsListSkeleton />;
}
