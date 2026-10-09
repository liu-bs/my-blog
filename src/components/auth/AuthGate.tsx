/**
 * @file AuthGate.tsx
 * @description 登录门禁组件：包裹需登录的内容（如仪表盘页）。鉴权信息加载中时直接放行渲染子内容，
 * 加载完成且未登录时以 LoginRequired 空态替换内容并引导登录；已登录正常渲染。
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { UserCircle } from "lucide-react";
import { messages } from "@/texts";

/**
 * 登录门禁
 * @param children 需登录后可见的内容
 * @warning loading 阶段不做拦截，子组件需能容忍 user 暂缺的短暂渲染
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={messages.errors.dashboardLoginDesc}
      />
    );
  }

  return <>{children}</>;
}
