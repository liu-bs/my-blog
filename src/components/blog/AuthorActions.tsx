/**
 * @file AuthorActions.tsx
 * @description 文章作者专属操作区权限门卫：仅当前登录用户为文章作者时渲染
 *              编辑+删除操作（DeletePostButton full 变体），否则不渲染任何内容
 */
"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DeletePostButton } from "./DeletePostButton";

/**
 * AuthorActions 作者操作区
 * @param postId 文章ID
 * @param authorId 文章作者ID
 * @param ssrUser 服务端注入的当前登录用户
 */
export function AuthorActions({
  postId,
  authorId,
  ssrUser,
}: {
  /** 文章ID */
  postId: string;

  /** 文章作者ID */
  authorId?: string;

  /** 服务端注入的当前登录用户 */
  ssrUser?: { id: string } | null;
}) {
  /** 当前登录用户（优先服务端注入值，避免首屏闪烁） */
  const user = useCurrentUser(ssrUser);

  // 非作者（或未登录/缺少作者ID）不渲染任何操作
  if (!user || !authorId || user.id !== authorId) return null;

  return <DeletePostButton postId={postId} variant="full" redirectTo="/posts" />;
}
