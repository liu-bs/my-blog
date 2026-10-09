/**
 * @file loading.tsx
 * @description 注册页（/register）路由级加载骨架，导航未完成时由 Next.js 自动渲染，
 * 展示与注册表单布局一致的占位界面
 */
import { RegisterSkeleton } from "@/components/skeletons/RegisterSkeleton";

/** 渲染注册页骨架屏 */
export default function Loading() {
  return <RegisterSkeleton />;
}
