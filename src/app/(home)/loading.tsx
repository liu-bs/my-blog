/**
 * @file loading.tsx
 * @description 首页（/）路由级加载骨架：首页服务端拉取最新文章期间
 * 由 Next.js 自动渲染的占位界面
 */
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";

/** 渲染首页骨架屏 */
export default function Loading() {
  return <HomeSkeleton />;
}
