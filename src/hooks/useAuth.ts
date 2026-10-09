/**
 * @file useAuth.ts
 * @description 登出操作 Hook：调用服务端 logoutAction 后无论成败都清理本地认证状态 Cookie 与 Context 用户态，
 * 并复用 useAsyncAction 提供 pending 与回调能力。仅限客户端使用。
 */
"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { logoutAction } from "@server/auth/auth.controller";

/**
 * 登出 Mutation Hook
 * @returns {@link useAsyncAction} 结构（mutate 触发登出、isPending 加载态）；action 固定返回 null
 * @warning 登出请求失败（网络异常等）也会执行本地清理，即"尽力登出"策略
 */
export function useLogout() {
  const { setMe } = useAuth();
  const action = useCallback(async () => {
    try {
      await logoutAction();
    } finally {
      // 无论服务端登出成败，都清除认证状态 Cookie 并广播跨标签登出信号
      clearAuthStatus();
      setMe(null);
    }
    return null;
  }, [setMe]);
  return useAsyncAction<void, null>(action);
}
