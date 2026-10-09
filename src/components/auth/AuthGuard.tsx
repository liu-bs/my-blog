/**
 * @file AuthGuard.tsx
 * @description 已登录重定向守卫：包裹登录/注册等"游客页"。检测到 URL 带 stale=1（登录态过期被
 * 服务端踢回）时先清空本地登录态并去掉该参数；已登录用户则在 500ms 后跳转到 redirect 参数
 * 指定的安全地址，跳转前不渲染子内容。
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { safeRedirect } from "@/lib/url";

/**
 * 已登录重定向守卫
 * @param children 未登录时正常渲染的页面内容（登录/注册表单）
 * @warning 500ms 延时跳转是给登录成功 toast/动画留缓冲，勿改成同步 replace
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setMe } = useAuth();

  const router = useRouter();

  /**
   * 依赖 user/router/setMe：
   * 1. URL 含 stale=1 时清空登录态与本地缓存，replace 回同路径（去除查询参数）；
   * 2. 已登录时解析 redirect 参数（经 safeRedirect 白名单校验）延时 500ms 跳转。
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("stale") === "1") {
      setMe(null);
      clearAuthStatus();

      router.replace(new URL(window.location.href).pathname);
      return;
    }

    if (!user) return;

    const raw = new URLSearchParams(window.location.search).get("redirect") || "/";
    const safe = safeRedirect(raw);

    const timer = setTimeout(() => router.replace(safe), 500);
    return () => clearTimeout(timer);
  }, [user, router, setMe]);

  if (user) return null;

  return <>{children}</>;
}
