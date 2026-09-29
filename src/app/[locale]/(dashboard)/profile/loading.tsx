/**
 * @file (dashboard)/profile/loading.tsx
 * @description 个人资料页的路由级 Suspense 骨架：资料页做登录校验与三路数据拉取期间展示，占位结构由 ProfileSkeleton 提供
 */
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";

/**
 * 资料页加载骨架
 * @description 作为 (dashboard)/profile/page.tsx 流式渲染期间的 fallback
 * @returns 资料页骨架组件
 */
export default function Loading() {
  return <ProfileSkeleton />;
}
