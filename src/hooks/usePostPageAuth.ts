/**
 * @file usePostPageAuth.ts
 * @description 文章详情页权限与状态聚合 Hook：组合当前用户、文章状态（PostStateProvider）与登录守卫，供详情页的点赞/收藏/评论等操作使用
 */
"use client";

import { useCurrentUser } from "./useCurrentUser";
import { usePostState, type PostStateValue } from "@/components/blog/PostStateProvider";
import { useRequireAuth } from "./useRequireAuth";
import { postPath } from "@shared";
import type { User } from "@shared";

/**
 * 文章详情页权限上下文
 */
interface PostPageAuthContext extends PostStateValue {
  /** 当前登录用户，未登录为 null */
  user: User | null;

  /** 带登录校验的动作执行器，未登录时跳转登录页 */
  requireAuth: (action: () => void) => void;
}

/**
 * 文章详情页权限与状态聚合 Hook
 * @param postId 文章ID，用于构造登录回跳路径
 * @param ssrUser 服务端渲染传入的用户
 * @returns 当前用户、文章状态、状态更新方法与登录守卫
 */
export function usePostPageAuth(postId: string, ssrUser?: User | null): PostPageAuthContext {
  const user = useCurrentUser(ssrUser);
  const { post, updatePost } = usePostState();
  const requireAuth = useRequireAuth(user, postPath(postId));

  return { user, post, updatePost, requireAuth };
}
