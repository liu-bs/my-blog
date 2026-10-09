/**
 * @file useCurrentUser.ts
 * @description 当前登录用户读取 Hook：优先取 AuthProvider 客户端态，回退到页面传入的 SSR 用户，实现水合前后一致
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import type { User } from "@shared";

/**
 * 获取当前用户（客户端态优先，SSR 数据兜底）
 * @param ssrUser 服务端渲染时注入的用户，可为 null
 * @returns 登录用户；未登录且无 SSR 数据时为 null
 */
export function useCurrentUser<T extends { id: string } = User>(
  ssrUser?: T | null,
): User | T | null {
  const { user: me } = useAuth();
  // 优先级：Context 实时态 > SSR 快照 > 未登录
  return me ?? ssrUser ?? null;
}
