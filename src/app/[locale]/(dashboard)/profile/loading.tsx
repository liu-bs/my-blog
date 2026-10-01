/**
 * @file loading.tsx
 * @description 个人中心页流式加载骨架屏，在数据就绪前展示占位结构
 */
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";

export default function Loading() {
  return <ProfileSkeleton />;
}
