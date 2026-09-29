/**
 * @file AuthGate.tsx
 * @description dashboard 的客户端登录守卫：在用户态尚未确定时展示骨架屏，未登录时渲染「请先登录」占位，
 *              已登录才放行子节点。与 AuthGuard 的差别在于「未登录不跳转、只就地提示」，
 *              适合出现在需要保留当前 URL 上下文的控制台页面
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * AuthGate 控制台登录态大门
 * @description 三态渲染，顺序不可调换：
 *              1）loading 为 true —— 用户态未知（正在拉取 /me 或读取本地缓存），先渲染骨架屏，避免守卫误判造成「已登录用户被闪一次登录提示」；
 *              2）user 为空 —— 渲染 {@link LoginRequired}，把当前路径作为 redirect 参数带到登录页；
 *              3）有 user —— 直接渲染 children。
 *              不在此处做跳转，跳转统一由服务端中间件与 AuthGuard 负责
 * @param props 组件入参
 * @param props.children 仅当已登录时才会被渲染的控制台内容
 * @returns 骨架屏 / 登录提示 / 业务子树的其中一种
 * @example
 * <AuthGate><WriteEditor /></AuthGate>
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const tErrors = useTranslations("errors");

  // 用户态未确定：先占位，防止误判
  if (loading) {
    return <DashboardSkeleton />;
  }

  // 确认未登录：就地提示并提供带 redirect 的登录入口
  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={tErrors("dashboardLoginDesc")}
      />
    );
  }

  // 已登录：放行
  return <>{children}</>;
}
