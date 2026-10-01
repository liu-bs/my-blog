/**
 * @file Sonner.tsx
 * @description 全局 toast 通知容器（基于 sonner）：主题跟随 next-themes 的当前生效主题，固定右下角、展示 3.5s，供 notify 工具触发
 */
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster 全局通知容器
 * @description 挂载于布局根部；resolvedTheme 为 dark 时用暗色皮肤，其余一律 light
 * @param props {@link ToasterProps} 可覆盖默认位置、时长等配置
 */
export function Toaster(props: ToasterProps) {
  // 当前生效主题（跟随系统或手动切换后的结果）
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      duration={3500}
      gap={8}
      className="app-toaster"
      toastOptions={{ className: "app-toast" }}
      {...props}
    />
  );
}
