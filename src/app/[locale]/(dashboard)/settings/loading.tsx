/**
 * @file loading.tsx
 * @description 设置页流式加载骨架屏，在页面内容就绪前展示占位结构
 */
import { SettingsSkeleton } from "@/components/skeletons/SettingsSkeleton";

export default function Loading() {
  return <SettingsSkeleton />;
}
