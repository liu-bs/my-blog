/**
 * @file loading.tsx
 * @description 登录页（/login）路由级加载骨架，导航到该路由未完成时由 Next.js
 * 自动渲染，展示与登录表单布局一致的占位界面
 */
import { LoginSkeleton } from "@/components/skeletons/LoginSkeleton";

/** 渲染登录页骨架屏 */
export default function Loading() {
  return <LoginSkeleton />;
}
