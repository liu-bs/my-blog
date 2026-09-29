/**
 * @file (dashboard)/settings/loading.tsx
 * @description 账号设置页的路由级 Suspense 骨架：设置页登录校验与翻译加载期间展示，占位结构由 SettingsSkeleton 提供
 */
import { SettingsSkeleton } from "@/components/skeletons/SettingsSkeleton";

/**
 * 设置页加载骨架
 * @description 作为 (dashboard)/settings/page.tsx 流式渲染期间的 fallback
 * @returns 设置页骨架组件
 */
export default function Loading() {
  return <SettingsSkeleton />;
}
