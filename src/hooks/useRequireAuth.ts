/**
 * @file useRequireAuth.ts
 * @description 登录态守卫 Hook：把「需要登录才能执行」的动作包一层，未登录时跳转登录页并带上回跳地址
 */
"use client";
import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { buildLoginRedirect } from "@/lib/url";
import type { User } from "@shared";

/**
 * 生成一个带登录校验的动作包装器
 * @param user 当前登录用户，为 null 表示未登录
 * @param redirectPath 登录成功后要跳回的路径（通常为当前页面地址）
 * @returns 包装函数：用户已登录则立即执行传入的 action；未登录则跳转到 `/login?redirect=...` 且不执行 action
 * @warning 返回函数依赖 user/redirectPath/router，登录态变化后会重新生成，请勿把它存进不会被更新的闭包
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
