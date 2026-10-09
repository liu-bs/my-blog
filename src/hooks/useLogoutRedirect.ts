/**
 * @file useLogoutRedirect.ts
 * @description 登出并回首页的组合 Hook：先执行退出前的清理回调（如关闭菜单），立即客户端跳转 "/"，再异步发起登出请求并 toast 结果
 */
"use client";

import { useRouter } from "next/navigation";
import { messages } from "@/texts";
import { notify } from "@/lib/toast";
import { useLogout } from "@/hooks/useAuth";

/**
 * 登出重定向 Hook
 * @param onBeforeLeave 跳转前执行的清理回调（如关闭下拉、清除本地态）
 * @returns 触发"登出+回首页"的函数，无参数无返回值
 * @warning 先 router.replace("/") 再发登出请求，界面跳转不等待登出完成；登出失败仅 toast 提示，不回滚跳转
 */
export function useLogoutRedirect(onBeforeLeave: () => void) {
  const router = useRouter();
  const logoutMutation = useLogout();

  return () => {
    onBeforeLeave();
    router.replace("/");
    logoutMutation.mutate(undefined, {
      onSuccess: () => notify.success(messages.feedback.session.loggedOut),
      onError: () => notify.fail(messages.feedback.session.logoutFailed),
    });
  };
}
