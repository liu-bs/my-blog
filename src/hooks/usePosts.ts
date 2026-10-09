/**
 * @file usePosts.ts
 * @description 帖子增删改与点赞/收藏 Mutation Hooks：统一封装博客服务端 Action，经 unwrap 归一错误后复用 useAsyncAction；
 * 删除与点赞/收藏自带 toast 反馈，创建/更新由调用方自行处理回调
 */
"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { messages } from "@/texts";
import { notify } from "@/lib/toast";
import { unwrap } from "@/lib/apiRequest";
import { toggleLikeAction, toggleFavoriteAction } from "@server/blog/blog.controller";
import { createPostAction, updatePostAction, deletePostAction } from "@server/blog/blog.controller";
import type { CreatePostDto, PostData, UpdatePostDto, UpdatePostMutationVars } from "@shared";

/** 帖子 Action 的统一调用入口：调用 Server Action 后用 unwrap 将失败结果转为抛错 */
const postActions = {
  create: (dto: CreatePostDto) => createPostAction(dto).then(unwrap<PostData>),
  update: (id: string, dto: UpdatePostDto) => updatePostAction(id, dto).then(unwrap<PostData>),
  remove: (id: string) => deletePostAction(id).then(unwrap<null>),
};

/**
 * 创建帖子 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate(dto) 成功返回新 PostData；无内置 toast，错误需调用方处理
 */
export function useCreatePost() {
  const action = useCallback((dto: CreatePostDto) => postActions.create(dto), []);
  return useAsyncAction<CreatePostDto, PostData>(action);
}

/**
 * 更新帖子 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate({ id, dto }) 成功返回更新后的 PostData；无内置 toast
 */
export function useUpdatePost() {
  const action = useCallback(
    ({ id, dto }: UpdatePostMutationVars) => postActions.update(id, dto),
    [],
  );
  return useAsyncAction<UpdatePostMutationVars, PostData>(action);
}

/**
 * 删除帖子 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate(id) 成功返回 null，自动弹出"已删除"/错误 toast
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
 * 点赞切换 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate(postId) 返回含 liked: boolean 的数据，按结果自动提示"点赞/取消点赞"
 */
export function useToggleLike() {
  return useTogglePostAssociation(
    (id: string) => toggleLikeAction(id).then(unwrap),
    "liked",
    "like",
  );
}

/**
 * 收藏切换 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate(postId) 返回含 favorited: boolean 的数据，按结果自动提示"收藏/取消收藏"
 */
export function useToggleFavorite() {
  return useTogglePostAssociation(
    (id: string) => toggleFavoriteAction(id).then(unwrap),
    "favorited",
    "favorite",
  );
}

/**
 * 点赞/收藏切换的通用工厂 Hook
 * @param apiFn 切换请求函数，入参为帖子 ID
 * @param dataKey 返回数据中表示切换后状态的布尔字段名（liked / favorited）
 * @param kind 反馈文案种类，用于拼接 messages.feedback.toggle 的键（如 likeOn / favoriteOff）
 * @returns {@link useAsyncAction} 结构，成功按状态弹 toast，失败弹错误 toast
 */
function useTogglePostAssociation<TData extends { [K in TKey]: boolean }, TKey extends string>(
  apiFn: (id: string) => Promise<TData>,
  dataKey: TKey,
  kind: "like" | "favorite",
) {
  const action = useCallback(
    async (id: string): Promise<TData> => {
      const data = await apiFn(id);
      // 依据切换后的布尔态选择 On/Off 文案
      notify.success(messages.feedback.toggle[`${kind}${data[dataKey] ? "On" : "Off"}`]);
      return data;
    },
    [apiFn, dataKey, kind],
  );

  return useAsyncAction<string, TData>(action, {
    onError: (err) => notify.error(err),
  });
}
