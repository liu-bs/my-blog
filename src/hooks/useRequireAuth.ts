/**
 * @file useRequireAuth.ts
 * @description 登录守卫 Hook：执行动作前校验登录态，未登录时跳转到带 redirect 回跳参数的登录页，已登录则直接执行动作
 */
"use client";
import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { buildLoginRedirect } from "@/lib/url";
import type { User } from "@shared";

/**
 * 创建带登录校验的动作执行器
 * @param user 当前用户，null 视为未登录
 * @param redirectPath 登录成功后回跳的路径
 * @returns requireAuth(action)：未登录时跳转登录页，已登录时直接执行 action
 */
export function useRequireAuth(user: User | null, redirectPath: string) {
  const router = useRouter();

  return useCallback(
    (action: () => void) => {
      if (!user) {
        router.push(buildLoginRedirect(redirectPath));
        return;
      }
      action();
    },
    [user, redirectPath, router],
  );
}
