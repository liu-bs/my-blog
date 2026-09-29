/**
 * @file Providers.tsx
 * @description 全局客户端 Provider 组合入口：按固定顺序挂载主题、登录态与全局 toast 容器，是应用根部唯一的客户端上下文装配点
 */
"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/AuthProvider";
import type { ProvidersProps } from "@shared";

/**
 * 全局 toast 容器
 * @description 关闭 SSR 并动态引入：sonner 只在浏览器端工作，且首屏用不到，
 *              延迟到客户端加载可以避免把它的体积算进服务端渲染产物
 */
const Toaster = dynamic(() => import("@/components/ui/Sonner").then((m) => m.Toaster), {
  ssr: false,
});

/**
 * Providers 全局 Provider 组合
 * @description 嵌套顺序及其理由：
 *              1）ThemeProvider 置于最外层 —— 主题需要尽早把 class 写到 html 上以减少首屏闪烁，
 *                 且它不依赖任何业务上下文（attribute=class 表示用类名驱动 Tailwind 的暗色变体；
 *                 enableSystem + defaultTheme=system 表示默认跟随系统；
 *                 disableTransitionOnChange 避免切换主题瞬间触发全站过渡而出现拖影）；
 *              2）AuthProvider 置于其内 —— 用户态只在浏览器端确认（依赖 localStorage 与 cookie），
 *                 且必须包住所有会调用 useAuth 的子树；
 *              3）Toaster 作为 AuthProvider 的子节点放在 children 之后 —— 全局只需挂载一次，
 *                 且挂在业务上下文内可让弹窗样式跟随主题与用户偏好
 * @param props {@link ProvidersProps}
 * @returns 已装配完整上下文的子树
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
