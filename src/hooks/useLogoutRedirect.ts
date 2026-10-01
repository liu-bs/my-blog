/**
 * @file useLogoutRedirect.ts
 * @description 登出并跳转 Hook：先执行离开前清理回调，再跳转首页并异步调用登出接口，按结果提示成功/失败文案
 */
"use client";

import { useRouter } from "@/i18n/navigation";
import { msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import { useLogout } from "@/hooks/useAuth";

/**
 * 创建"登出并跳转首页"的处理函数
 * @param onBeforeLeave 跳转前执行的清理回调（如清空本地草稿）
 * @returns 触发登出流程的函数
 */
export function useLogoutRedirect(onBeforeLeave: () => void) {
  const router = useRouter();
  const logoutMutation = useLogout();

  return () => {
    onBeforeLeave();
    router.replace("/");
    logoutMutation.mutate(undefined, {
      onSuccess: () => notify.success(msg("session", "loggedOut")),
      onError: () => notify.fail(msg("session", "logoutFailed")),
    });
  };
}
