/**
 * @file usePostPageAuth.ts
 * @description 文章详情页的「用户 + 文章状态 + 鉴权动作」聚合 Hook，把页面里到处要用的三件事一次性取齐
 */
"use client";

import { useCurrentUser } from "./useCurrentUser";
import { usePostState, type PostStateValue } from "@/components/blog/PostStateProvider";
import { useRequireAuth } from "./useRequireAuth";
import { postPath } from "@shared";
import type { User } from "@shared";

/**
 * usePostPageAuth 的返回值
 */
interface PostPageAuthContext extends PostStateValue {
  /** 当前登录用户，未登录为 null */
  user: User | null;

  /** 包装需要登录才能执行的动作：未登录时跳转登录页并携带当前文章回跳地址，已登录则直接执行 */
  requireAuth: (action: () => void) => void;
}

/**
 * 聚合文章详情页所需的鉴权与文章状态
 * @description 回跳路径取自当前文章详情地址（postPath(postId)），保证登录后回到同一篇文章
 * @param postId 当前文章 id
 * @param ssrUser 服务端读取的用户快照，作为未登录时的兜底
 * @returns 用户、文章状态与 requireAuth {@link PostPageAuthContext}
 */
export function usePostPageAuth(postId: string, ssrUser?: User | null): PostPageAuthContext {
  const user = useCurrentUser(ssrUser);
  const { post, updatePost } = usePostState();
  const requireAuth = useRequireAuth(user, postPath(postId));

  return { user, post, updatePost, requireAuth };
}
