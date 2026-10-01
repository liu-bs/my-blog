/**
 * @file usePosts.ts
 * @description 文章操作 Hooks：创建/更新/删除文章与点赞/收藏切换，均通过 Server Action 调用服务端，返回的 ActionResult 经 unwrap 拆箱；配合 useAsyncAction 提供互斥的 mutate/isPending
 */
"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import { unwrap } from "@/lib/actionResult";
import { toggleLikeAction, toggleFavoriteAction } from "@server/blog/blog.controller";
import { createPostAction, updatePostAction, deletePostAction } from "@server/blog/blog.controller";
import type { CreatePostDto, PostData, UpdatePostDto, UpdatePostMutationVars } from "@shared";

/**
 * 文章增删改动作集合，统一经 unwrap 拆箱 ActionResult，失败抛 ApiRequestError
 */
const postActions = {
  create: (dto: CreatePostDto) => createPostAction(dto).then(unwrap<PostData>),
  update: (id: string, dto: UpdatePostDto) => updatePostAction(id, dto).then(unwrap<PostData>),
  remove: (id: string) => deletePostAction(id).then(unwrap<null>),
};

/**
 * 创建文章 Hook
 * @returns 创建动作（mutate/isPending），入参为文章表单数据
 */
export function useCreatePost() {
  const action = useCallback((dto: CreatePostDto) => postActions.create(dto), []);
  return useAsyncAction<CreatePostDto, PostData>(action);
}

/**
 * 更新文章 Hook
 * @returns 更新动作（mutate/isPending），入参为 { id, dto }
 */
export function useUpdatePost() {
  const action = useCallback(
    ({ id, dto }: UpdatePostMutationVars) => postActions.update(id, dto),
    [],
  );
  return useAsyncAction<UpdatePostMutationVars, PostData>(action);
}

/**
 * 删除文章 Hook
 * @returns 删除动作（mutate/isPending），入参为文章ID，成功/失败有 toast 提示
 */
export function useDeletePost() {
  const action = useCallback(async (id: string) => {
    await postActions.remove(id);
    return null;
  }, []);
  return useAsyncAction<string, null>(action, {
    onSuccess: () => notify.deleted("post"),
    onError: (err) => notify.error(err),
  });
}

/**
 * 切换文章点赞 Hook
 * @returns 切换动作（mutate/isPending），入参为文章ID，成功后按新状态提示
 */
export function useToggleLike() {
  return useTogglePostAssociation(
    (id: string) => toggleLikeAction(id).then(unwrap),
    "liked",
    "like",
  );
}

/**
 * 切换文章收藏 Hook
 * @returns 切换动作（mutate/isPending），入参为文章ID，成功后按新状态提示
 */
export function useToggleFavorite() {
  return useTogglePostAssociation(
    (id: string) => toggleFavoriteAction(id).then(unwrap),
    "favorited",
    "favorite",
  );
}

/**
 * 点赞/收藏切换的通用实现
 * @param apiFn 调用 Server Action 并拆箱的函数
 * @param dataKey 返回数据中布尔标记的字段名
 * @param kind 操作类型，用于拼接 toast 文案
 * @returns 切换动作（mutate/isPending），失败时 toast 提示
 */
function useTogglePostAssociation<TData extends { [K in TKey]: boolean }, TKey extends string>(
  apiFn: (id: string) => Promise<TData>,
  dataKey: TKey,
  kind: "like" | "favorite",
) {
  const action = useCallback(
    async (id: string): Promise<TData> => {
      const data = await apiFn(id);
      notify.success(msg("toggle", data[dataKey] ? `${kind}On` : `${kind}Off`));
      return data;
    },
    [apiFn, dataKey, kind],
  );

  return useAsyncAction<string, TData>(action, {
    onError: (err) => notify.error(err),
  });
}
