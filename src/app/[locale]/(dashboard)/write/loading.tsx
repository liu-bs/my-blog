/**
 * @file loading.tsx
 * @description 写作页流式加载骨架屏，在编辑器就绪前展示占位结构
 */
import { WriteSkeleton } from "@/components/skeletons/WriteSkeleton";

export default function Loading() {
  return <WriteSkeleton />;
}
