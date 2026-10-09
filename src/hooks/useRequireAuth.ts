/**
 * @file useRequireAuth.ts
 * @description "需登录操作"守卫 Hook：未登录时跳转登录页并携带回跳地址，已登录时直接执行目标操作
 */
"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { buildLoginRedirect } from "@/lib/url";
import type { User } from "@shared";

/**
 * 生成登录守卫函数
 * @param user 当前用户，null 视为未登录
 * @param redirectPath 登录后希望回跳的目标路径
 * @returns 守卫函数：已登录执行 action，未登录跳转 /login?redirect=... 且不执行
 */
export function useRequireAuth(user: User | null, redirectPath: string) {
  const router = useRouter();

  return useCallback(
    (action: () => void) => {
      if (!user) {
        // 未登录：带 redirect 参数跳登录页，放弃本次操作
        router.push(buildLoginRedirect(redirectPath));
        return;
      }
      action();
    },
    [user, redirectPath, router],
  );
}
