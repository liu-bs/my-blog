/**
 * @file useAuth.ts
 * @description 认证相关 mutation Hook；当前仅承载登出（useLogout），文件名沿用 useAuth
 */
"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { logoutAction } from "@server/auth/auth.controller";

/**
 * 登出 Hook
 * @description 先请求服务端注销会话，无论请求成功与否都在 finally 中清空本地登录态——
 * 清 cookie 标记（clearAuthStatus）并重置内存中的用户，避免网络异常时界面仍停留在「已登录」
 * @returns mutation 结果，其中 mutate 入参为 void（调用时传 undefined），返回 null {@link useAsyncAction}
 * @example
 * const logout = useLogout();
 * logout.mutate(undefined, { onSuccess: () => router.replace("/") });
 */
export function useLogout() {
  const { setMe } = useAuth();
  const action = useCallback(async () => {
    try {
      await logoutAction();
    } finally {
      // 服务端登出失败也要清本地态，防止出现「服务端已失效、界面仍显示已登录」的错位
      clearAuthStatus();
      setMe(null);
    }
    return null;
  }, [setMe]);
  return useAsyncAction<void, null>(action);
}
