/**
 * @file AuthorActions.tsx
 * @description 文章作者操作区组件：仅当当前登录用户是文章作者时，渲染完整形态的
 * DeletePostButton（编辑+删除，删除后跳回 /posts）；非作者或游客不渲染任何内容。
 * 用于文章详情页底部。
 */
"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DeletePostButton } from "./DeletePostButton";

/**
 * 作者专属操作区
 * @param postId 文章ID
 * @param authorId 文章作者ID，缺失时不渲染
 * @param ssrUser 服务端渲染透传的当前用户（仅含 id），供 useCurrentUser 复用避免二次拉取
 */
export function AuthorActions({
  postId,
  authorId,
  ssrUser,
}: {
  /** 文章ID */
  postId: string;

  /** 文章作者ID，缺失时不渲染 */
  authorId?: string;

  /** SSR 透传的当前用户（仅含 id） */
  ssrUser?: { id: string } | null;
}) {
  const user = useCurrentUser(ssrUser);

  // 非作者（含未登录）直接不渲染
  if (!user || !authorId || user.id !== authorId) return null;

  return <DeletePostButton postId={postId} variant="full" redirectTo="/posts" />;
}
