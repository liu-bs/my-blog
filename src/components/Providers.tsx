/**
 * @file Providers.tsx
 * @description 应用根客户端 Provider 集合：嵌套 ThemeProvider（明暗主题）与 AuthProvider（登录态），
 * 并在客户端挂载后渲染全局 Toaster；由根布局 layout.tsx 包裹全站页面使用
 */
"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/Sonner";
import type { ProvidersProps } from "@shared";

/**
 * 根 Provider 组合组件
 * @param props.children 全站页面子树
 */
export function Providers({ children }: ProvidersProps) {
  // ponytail: 全量挂载后才渲染 Toaster——cacheComponents 的 instant shell 里不能出现
  // ssr:false 的 next/dynamic（会 BAILOUT_TO_CLIENT_SIDE_RENDERING 导致校验报错）。
  // 若日后 Toaster 体积变大需要代码分割，可换 React 的 <Suspense> + client boundary 方案。
  const [mounted, setMounted] = useState(false);

  /* 标记客户端已挂载，用于延迟渲染依赖 document 的 Toaster */
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    /* 主题层 → 登录态层 → 页面内容；Toaster 仅挂载后渲染 */
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        {mounted && <Toaster />}
      </AuthProvider>
    </ThemeProvider>
  );
}
