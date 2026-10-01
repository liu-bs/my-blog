/**
 * @file AuthGate.tsx
 * @description 前端认证门控组件：认证加载中展示 DashboardSkeleton，未登录展示 LoginRequired 引导页，已登录渲染 children；真实拦截由 src/proxy.ts（无 token 重定向）与 dashboard layout 服务端兜底
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * AuthGate 认证门控
 * @description 仅做前端体验层分流，非安全边界
 * @param children 已登录时渲染的内容
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const tErrors = useTranslations("errors");

  // 认证状态加载中：展示仪表盘骨架占位
  if (loading) {
    return <DashboardSkeleton />;
  }

  // 未登录：展示「需要登录」引导页，按钮携带当前路径跳登录页
  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={tErrors("dashboardLoginDesc")}
      />
    );
  }

  return <>{children}</>;
}
