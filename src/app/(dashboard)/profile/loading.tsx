/**
 * @file loading.tsx
 * @description 个人中心页（/profile）路由级加载骨架：页面服务端拉取用户与文章数据
 * 期间由 Next.js 自动渲染占位界面
 */
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";

/** 渲染个人中心骨架屏 */
export default function Loading() {
  return <ProfileSkeleton />;
}
