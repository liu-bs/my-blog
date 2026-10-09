/**
 * @file usePostPageAuth.ts
 * @description 文章详情页权限上下文聚合 Hook：一次性提供当前用户、可编辑帖子状态与"未登录先跳登录"的操作守卫，供详情页各组件共享
 */
"use client";

import { useCurrentUser } from "./useCurrentUser";
import { usePostState, type PostStateValue } from "@/components/blog/PostStateProvider";
import { useRequireAuth } from "./useRequireAuth";
import { postPath } from "@shared";
import type { User } from "@shared";

/**
 * 文章页权限上下文：帖子状态 + 当前用户 + 鉴权守卫
 */
interface PostPageAuthContext extends PostStateValue {
  /** 当前登录用户（SSR 兜底后），未登录为 null */
  user: User | null;

  /** 需登录操作守卫：已登录执行 action，未登录跳转登录页并携带回跳地址 */
  requireAuth: (action: () => void) => void;
}

/**
 * 获取文章详情页权限上下文
 * @param postId 当前文章 ID，用于拼接登录回跳路径
 * @param ssrUser SSR 阶段注入的用户，水合前兜底
 * @returns {@link PostPageAuthContext}（user、post、updatePost、requireAuth）
 */
export function usePostPageAuth(postId: string, ssrUser?: User | null): PostPageAuthContext {
  const user = useCurrentUser(ssrUser);
  const { post, updatePost } = usePostState();
  const requireAuth = useRequireAuth(user, postPath(postId));

  return { user, post, updatePost, requireAuth };
}
