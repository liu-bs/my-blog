/**
 * @file useCurrentUser.ts
 * @description 读取「当前登录用户」的统一出口：优先使用客户端 AuthProvider 持有的实时用户，服务端渲染结果仅作首屏兜底
 */
"use client";

import { useAuth } from "@/components/AuthProvider";
import type { User } from "@shared";

/**
 * 获取当前用户，客户端状态优先于 SSR 数据
 * @description 优先级为「客户端内存中的 me > 传入的 ssrUser > null」：登录/登出后 setMe 会立刻更新，
 * 而 ssrUser 是页面渲染时的快照，若反过来以 SSR 为准会导致登出后仍短暂显示旧用户
 * @param ssrUser 服务端页面传入的用户快照，可为空
 * @returns 当前用户；未登录时为 null
 */
export function useCurrentUser<T extends { id: string } = User>(
  ssrUser?: T | null,
): User | T | null {
  const { user: me } = useAuth();
  return me ?? ssrUser ?? null;
}
