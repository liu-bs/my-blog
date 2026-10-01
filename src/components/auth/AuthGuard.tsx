/**
 * @file AuthGuard.tsx
 * @description 登录页 / 注册页的外层守卫：已登录用户访问这些页面时按 redirect 参数跳回目标页，
 *              同时负责消费中间件写入的 `stale=1` 标记（表示 cookie 已失效）以清空前端用户态。
 *              与 AuthGate 的分工：AuthGate 保护「需要登录的页面」，AuthGuard 劝退「已登录不该访问的页面」
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/AuthProvider";
import { clearAuthStatus } from "@/lib/authStatus";
import { safeRedirect } from "@/lib/url";

/**
 * AuthGuard 已登录访客劝退守卫
 * @description 只做两件事，均放在 effect 中以避免渲染期产生副作用：
 *              1）URL 带 `stale=1` 时说明服务端判定会话已失效，立即清空本地用户态与鉴权标记，
 *                 并提前 return（此时不再尝试跳转）；
 *              2）已登录时延迟 500ms 再跳转，给用户留出「刚刚登录成功」的视觉确认时间；
 *                 目标是经 safeRedirect 清洗过的站点内路径，防止 redirect 参数被用作开放重定向。
 *              用户态未知（user 为 null）时不渲染 children 之外的任何内容
 * @param props 组件入参
 * @param props.children 未登录时才渲染的登录 / 注册表单
 * @returns 已登录返回 null（等待跳转），否则渲染 children
 * @warning 跳转依赖客户端用户态，若仅凭 cookie 判定会更即时，但这里刻意复用 AuthProvider 的单一数据源
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setMe } = useAuth();

  const router = useRouter();

  /**
   * 依据用户态与 URL 参数决定是否跳转
   * @description 清理逻辑与跳转逻辑互斥：stale 场景清态后直接返回；
   *              跳转用定时器延迟执行，并在依赖变化（user 变空 / 卸载）时清除，避免竞态与内存泄漏
   */
  useEffect(() => {
    // 服务端已判定会话失效：清空前端状态，避免停留在「假的已登录」界面
    if (new URLSearchParams(window.location.search).get("stale") === "1") {
      setMe(null);
      clearAuthStatus();
      // 抹掉 stale 参数，避免用户把这个一次性标记带进收藏/分享的 URL 后每次进来都强制登出
      router.replace(new URL(window.location.href).pathname);
      return;
    }

    if (!user) return;

    const raw = new URLSearchParams(window.location.search).get("redirect") || "/";
    const safe = safeRedirect(raw);

    // 延迟跳转，让「登录成功」的反馈先被用户看到
    const timer = setTimeout(() => router.replace(safe), 500);
    return () => clearTimeout(timer);
  }, [user, router, setMe]);

  // 已登录：不渲染表单，等待上面的跳转生效
  if (user) return null;

  return <>{children}</>;
}
