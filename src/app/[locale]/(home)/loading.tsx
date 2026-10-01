/**
 * @file loading.tsx
 * @description 首页流式加载骨架屏，在页面数据就绪前展示与最终布局对应的占位结构
 */
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";

export default function Loading() {
  return <HomeSkeleton />;
}
