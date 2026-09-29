/**
 * @file usePosts.ts
 * @description 文章写操作的 Hook 集合：创建/更新/删除，以及点赞/收藏的切换；统一复用 useAsyncAction 处理 pending 与提示
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

/** 文章写操作的 Server Action 包装，统一把 ActionResult 解包为数据或抛出 ApiRequestError */
const postActions = {
  create: (dto: CreatePostDto) => createPostAction(dto).then(unwrap<PostData>),
  update: (id: string, dto: UpdatePostDto) => updatePostAction(id, dto).then(unwrap<PostData>),
  remove: (id: string) => deletePostAction(id).then(unwrap<null>),
};

/**
 * 创建文章
 * @returns mutation，入参为文章 DTO，返回新文章数据；不自动提示，由调用方决定跳转或提示
 */
export function useCreatePost() {
  const action = useCallback((dto: CreatePostDto) => postActions.create(dto), []);
  return useAsyncAction<CreatePostDto, PostData>(action);
}

/**
 * 更新文章
 * @returns mutation，入参为 { id, dto }，返回更新后的文章数据；不自动提示
 */
export function useUpdatePost() {
  const action = useCallback(
    ({ id, dto }: UpdatePostMutationVars) => postActions.update(id, dto),
    [],
  );
  return useAsyncAction<UpdatePostMutationVars, PostData>(action);
}

/**
 * 删除文章
 * @returns mutation，入参为文章 id，成功 toast「文章已删除」、失败统一提示
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
 * 点赞/取消点赞
 * @returns mutation，入参为文章 id，返回含 liked 最新值的对象；调用方据此乐观更新计数
 */
export function useToggleLike() {
  return useTogglePostAssociation(
    (id: string) => toggleLikeAction(id).then(unwrap),
    "liked",
    "like",
  );
}

/**
 * 收藏/取消收藏
 * @returns mutation，入参为文章 id，返回含 favorited 最新值的对象
 */
export function useToggleFavorite() {
  return useTogglePostAssociation(
    (id: string) => toggleFavoriteAction(id).then(unwrap),
    "favorited",
    "favorite",
  );
}

/**
 * 点赞与收藏共用的切换逻辑
 * @description 两者接口形态一致（都返回一个布尔字段表示切换后的状态），差异只在字段名与提示文案，
 * 故抽取为泛型函数；成功时按切换后的状态提示「已点赞/已取消点赞」
 * @param apiFn 实际调用的 Server Action，返回含目标字段的对象
 * @param dataKey 结果中表示切换后状态的字段名（liked / favorited）
 * @param kind 业务类型，用于拼装 i18n 文案 key（like/favorite）
 * @returns mutation，失败时统一 toast
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
