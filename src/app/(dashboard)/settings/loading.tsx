/**
 * @file loading.tsx
 * @description 设置页（/settings）路由级加载骨架，导航未完成时由 Next.js 自动渲染
 */
import { SettingsSkeleton } from "@/components/skeletons/SettingsSkeleton";

/** 渲染设置页骨架屏 */
export default function Loading() {
  return <SettingsSkeleton />;
}
