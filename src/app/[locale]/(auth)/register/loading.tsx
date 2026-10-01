/**
 * @file loading.tsx
 * @description 注册页流式加载骨架屏，在表单就绪前展示占位结构
 */
import { RegisterSkeleton } from "@/components/skeletons/RegisterSkeleton";

export default function Loading() {
  return <RegisterSkeleton />;
}
