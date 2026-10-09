/**
 * @file Sonner.tsx
 * @description 全局 Toast 容器组件，封装 sonner 的 Toaster：跟随 next-themes 明暗主题、固定右下角弹出、3.5s 自动消失；
 * 由 Providers 在客户端挂载后渲染，业务代码通过 sonner 的 toast() API 触发提示
 */
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * 全局 Toaster，挂载于应用根部（Providers 内）
 * @param props sonner 原生 ToasterProps，可覆盖默认配置（后展开，外部传入优先）
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    /* sonner Toaster：主题跟随系统解析结果，右下角定位，统一 app-toaster/app-toast 样式钩子 */
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
