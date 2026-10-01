/**
 * @file AuthGuard.tsx
 * @description 登录后守卫组件（用于登录/注册页）：已登录时自动跳转 redirect 参数目标（safeRedirect 校验）；URL 带 stale=1 时清除本地用户与登录状态并去参重载；未登录渲染 children
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { safeRedirect } from "@/lib/url";

/**
 * AuthGuard 已登录跳转守卫
 * @description 服务端判定本地认证缓存过期时以 stale=1 重定向回登录页，此处在前端完成状态清理
 * @param children 未登录时渲染的内容
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setMe } = useAuth();

  const router = useRouter();

  /**
   * 已登录自动跳转 / 失效状态清理，登录状态变化时重新评估
   */
  useEffect(() => {
    // stale=1：本地认证缓存已被服务端判定失效，清空用户与登录状态标记，并去掉查询参数重载当前页
    if (new URLSearchParams(window.location.search).get("stale") === "1") {
      setMe(null);
      clearAuthStatus();

      router.replace(new URL(window.location.href).pathname);
      return;
    }

    // 未登录无需跳转
    if (!user) return;

    // 已登录：redirect 参数经 safeRedirect 校验后延迟 500ms 跳转，留出提示展示时间
    const raw = new URLSearchParams(window.location.search).get("redirect") || "/";
    const safe = safeRedirect(raw);

    const timer = setTimeout(() => router.replace(safe), 500);
    return () => clearTimeout(timer);
  }, [user, router, setMe]);

  // 已登录时不再渲染登录页内容
  if (user) return null;

  return <>{children}</>;
}
