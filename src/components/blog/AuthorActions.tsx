/**
 * @file AuthorActions.tsx
 * @description 文章详情页的作者专属操作入口；仅当当前登录用户是文章作者时才渲染，内部复用删除按钮
 */
"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DeletePostButton } from "./DeletePostButton";

/**
 * AuthorActions 作者操作区
 * @description 展示条件：当前用户存在且其 id 与文章 authorId 一致（即作者本人）。
 *              未满足条件时返回 null，页面上不出现任何作者入口，权限判定以服务端为准，这里只是前端可见性收敛。
 * @param props.postId 目标文章 ID
 * @param props.authorId 文章作者 ID；缺失时视为非作者，不渲染操作
 * @param props.ssrUser 服务端下发的当前用户，用于客户端登录态就绪前先按 SSR 结果判断
 * @returns 作者本人可见的删除按钮，否则 null
 */
export function AuthorActions({
  postId,
  authorId,
  ssrUser,
}: {
  postId: string;

  authorId?: string;

  ssrUser?: { id: string } | null;
}) {
  /** 当前登录用户：客户端登录态优先，回退到 SSR 下发的用户 */
  const user = useCurrentUser(ssrUser);

  /** 非作者或未登录直接不渲染，避免非作者看到编辑 / 删除入口 */
  if (!user || !authorId || user.id !== authorId) return null;

  /** 作者操作：删除按钮（full 形态展示编辑 + 删除），删除成功后跳回文章列表 */
  return <DeletePostButton postId={postId} variant="full" redirectTo="/posts" />;
}
