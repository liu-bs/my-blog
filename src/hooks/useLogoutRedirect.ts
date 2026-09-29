/**
 * @file useLogoutRedirect.ts
 * @description 「登出并回首页」的一体化操作：立即跳转、异步登出、按结果提示，供导航栏等入口复用
 */
"use client";

import { useRouter } from "@/i18n/navigation";
import { msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import { useLogout } from "@/hooks/useAuth";

/**
 * 生成登出执行函数
 * @description 跳转与登出同时进行：先执行 onBeforeLeave（用于同步清理本地草稿/脏标记等），
 * 再 replace 到首页（不产生历史记录，避免用户后退回到已登出的页面），最后异步请求登出并按结果提示，
 * 因此网络失败也不会阻塞跳转
 * @param onBeforeLeave 离开前同步执行的清理回调
 * @returns 无参的触发函数；每次渲染返回新函数，可安全用于事件绑定
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
