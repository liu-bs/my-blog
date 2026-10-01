/**
 * @file Providers.tsx
 * @description 全局 Provider 组合：next-themes 主题（跟随系统、class 策略、切换时禁过渡）+
 *              AuthProvider 登录态 + 动态加载的 Toaster 通知（ssr:false）
 */
"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/AuthProvider";
import type { ProvidersProps } from "@shared";

/** Toaster 通知组件孤岛：关闭 SSR，首帧后按需加载 */
const Toaster = dynamic(() => import("@/components/ui/Sonner").then((m) => m.Toaster), {
  ssr: false,
});

/**
 * Providers 全局 Provider 组合
 * @param children 应用子节点
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
