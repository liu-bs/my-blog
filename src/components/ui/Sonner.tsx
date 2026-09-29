/**
 * @file Sonner.tsx
 * @description sonner 的全局 toast 容器封装，把主题与项目默认展示参数注入在唯一入口，避免各调用点重复配置
 */
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster 全局通知容器
 * @param props {@link ToasterProps}，可覆盖默认主题/位置/时长，最终透传给 sonner 的 Toaster
 * @returns 挂载在应用根部的 toast 宿主；由 next-themes 的 resolvedTheme 决定明暗皮肤
 * @warning 需在客户端渲染，且每个应用只应挂载一次，否则同一条 toast 会被多个容器重复消费；toast 文案由各调用点自行经 next-intl 传入，故此处不引入 i18n，避免耦合语言前缀
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    // theme 取解析后的实际主题（而非用户偏好），避免 system 模式下皮肤错配
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
