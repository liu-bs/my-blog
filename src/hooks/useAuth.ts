"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/auth-status";
import { logoutAction } from "@server/auth/auth.controller";

export function useLogout() {
  const { setMe } = useAuth();
  const action = useCallback(async () => {
    const result = await logoutAction();

    // auth_token 是 httpOnly，前端删不掉。服务端没确认登出就清本地状态，
    // 会出现「界面已登出、服务端会话仍可用」的假登出窗口（共用电脑场景尤其危险）。
    if (!result.ok && result.status !== 401) {
      throw new Error(result.message);
    }

    clearAuthStatus();
    setMe(null);
    return null;
  }, [setMe]);
  return useAsyncAction<void, null>(action);
}
