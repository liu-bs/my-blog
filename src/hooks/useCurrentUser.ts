/**
 * @file useCurrentUser.ts
 * @description 获取当前用户 Hook：优先取 AuthProvider 的客户端登录态，无登录时回退到 SSR 传入的用户（如文章作者）
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import type { User } from "@shared";

/**
 * 获取当前生效用户
 * @param ssrUser 服务端渲染传入的用户（如文章作者），客户端登录态优先
 * @returns 当前用户，客户端与 SSR 均无时为 null
 */
export function useCurrentUser<T extends { id: string } = User>(
  ssrUser?: T | null,
): User | T | null {
  const { user: me } = useAuth();
  return me ?? ssrUser ?? null;
}
