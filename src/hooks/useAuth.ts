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

    if (!result.ok && result.status !== 401) {
      throw new Error(result.message);
    }

    clearAuthStatus();
    setMe(null);
    return null;
  }, [setMe]);
  return useAsyncAction<void, null>(action);
}
