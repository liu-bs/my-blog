/**
 * @file (home)/loading.tsx
 * @description 首页的 Suspense 骨架屏。作为 page 的 loading 约定文件，在服务端取数期间先渲染占位，避免白屏
 */
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";

/**
 * Loading 首页加载占位
 * @description 由 Next.js 在首页 Suspense 边界挂起时渲染；具体骨架结构由 HomeSkeleton 负责
 */
export default function Loading() {
  return <HomeSkeleton />;
}
