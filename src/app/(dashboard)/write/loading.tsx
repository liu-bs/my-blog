/**
 * @file loading.tsx
 * @description 写作页（/write）路由级加载骨架：服务端鉴权与文章预取期间
 * 由 Next.js 自动渲染的占位界面
 */
import { WriteSkeleton } from "@/components/skeletons/WriteSkeleton";

/** 渲染写作页骨架屏 */
export default function Loading() {
  return <WriteSkeleton />;
}
