/**
 * @file useAuth.ts
 * @description 登出 Hook：调用登出 Server Action，无论接口成败都清除本地登录状态 cookie 并同步 AuthProvider；配合 useAsyncAction 暴露 mutate/isPending
 */
"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { logoutAction } from "@server/auth/auth.controller";

/**
 * 登出 Hook
 * @returns 登出动作（mutate/isPending），成功后数据恒为 null
 */
export function useLogout() {
  const { setMe } = useAuth();
  const action = useCallback(async () => {
    try {
      await logoutAction();
    } finally {
      // 无论登出接口成败，都清理本地登录状态
      clearAuthStatus();
      setMe(null);
    }
    return null;
  }, [setMe]);
  return useAsyncAction<void, null>(action);
}
