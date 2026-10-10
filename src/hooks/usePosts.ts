"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { messages } from "@/texts";
import { notify } from "@/lib/toast";
import { unwrap } from "@/lib/apiRequest";
import { toggleLikeAction, toggleFavoriteAction } from "@server/blog/blog.controller";
import { createPostAction, updatePostAction, deletePostAction } from "@server/blog/blog.controller";
import type { CreatePostDto, PostData, UpdatePostDto, UpdatePostMutationVars } from "@shared";

const postActions = {
  create: (dto: CreatePostDto) => createPostAction(dto).then(unwrap<PostData>),
  update: (id: string, dto: UpdatePostDto) => updatePostAction(id, dto).then(unwrap<PostData>),
  remove: (id: string) => deletePostAction(id).then(unwrap<null>),
};

export function useCreatePost() {
  const action = useCallback((dto: CreatePostDto) => postActions.create(dto), []);
  return useAsyncAction<CreatePostDto, PostData>(action);
}

export function useUpdatePost() {
  const action = useCallback(
    ({ id, dto }: UpdatePostMutationVars) => postActions.update(id, dto),
    [],
  );
  return useAsyncAction<UpdatePostMutationVars, PostData>(action);
}

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

export function useToggleLike() {
  return useTogglePostAssociation(
    (id: string) => toggleLikeAction(id).then(unwrap),
    "liked",
    "like",
  );
}

export function useToggleFavorite() {
  return useTogglePostAssociation(
    (id: string) => toggleFavoriteAction(id).then(unwrap),
    "favorited",
    "favorite",
  );
}

function useTogglePostAssociation<TData extends { [K in TKey]: boolean }, TKey extends string>(
  apiFn: (id: string) => Promise<TData>,
  dataKey: TKey,
  kind: "like" | "favorite",
) {
  const action = useCallback(
    async (id: string): Promise<TData> => {
      const data = await apiFn(id);

      notify.success(messages.feedback.toggle[`${kind}${data[dataKey] ? "On" : "Off"}`]);
      return data;
    },
    [apiFn, dataKey, kind],
  );

  return useAsyncAction<string, TData>(action, {
    onError: (err) => notify.error(err),
  });
}
