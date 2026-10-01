/**
 * @file loading.tsx
 * @description 登录页流式加载骨架屏，在表单就绪前展示占位结构
 */
import { LoginSkeleton } from "@/components/skeletons/LoginSkeleton";

export default function Loading() {
  return <LoginSkeleton />;
}
