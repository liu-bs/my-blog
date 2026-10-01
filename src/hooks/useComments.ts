/**
 * @file useComments.ts
 * @description 文章评论 Hooks：useComments 分页拉取评论（api.get 调 Route Handler，AbortController + 代际计数防竞态）并提供本地增删改同步；useCreateComment/useUpdateComment/useDeleteComment 封装对应 Server Action，结果经 unwrap 拆箱
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/toast";
import { unwrap } from "@/lib/actionResult";
import {
  createCommentAction,
  updateCommentAction,
  deleteCommentAction,
} from "@server/comment/comment.controller";
import { api } from "@/lib/apiRequest";
import type {
  Comment,
  CommentsListData,
  CreateCommentDto,
  UpdateCommentMutationVars,
} from "@shared";

/** 每页评论条数 */
export const COMMENTS_PAGE_SIZE = 10;

/**
 * 评论列表查询 Hook
 * @param postId 文章ID，为空时不发起请求
 * @param pageSize 每页条数
 * @returns 评论列表数据、加载状态、加载更多与本地增删改方法
 */
export function useComments(postId: string, pageSize = COMMENTS_PAGE_SIZE) {
  const [data, setData] = useState<CommentsListData | null>(null);
  const [isLoading, setIsLoading] = useState(!!postId);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);

  /** 刷新计数，refetch 时 +1 触发列表重新拉取 */
  const [tick, setTick] = useState(0);

  /** 已加载评论数，作为下一页请求的 offset */
  const loadedRef = useRef(0);

  /** 请求代际计数，postId/refetch 变化时自增，用于丢弃过期响应 */
  const genRef = useRef(0);

  /** 重新拉取第一页 */
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!postId) return;

    // 自增代际并中止上一轮请求，仅接受最新一次的结果
    genRef.current += 1;
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    loadedRef.current = 0;
    api
      .get<CommentsListData>(
        `/posts/${postId}/comments`,
        { limit: pageSize, offset: 0 },
        { signal: controller.signal },
      )
      .then((result) => {
        if (cancelled) return;
        setData(result);
        loadedRef.current = result.comments.length;
        setIsError(false);
      })
      .catch(() => {
        // 首屏加载失败仅置错误态，由页面展示
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      // 卸载或依赖变化时标记取消并中止进行中的请求
      cancelled = true;
      controller.abort();
    };
  }, [postId, tick, pageSize]);

  /**
   * 加载下一页，按代际丢弃过期响应，按评论ID去重后追加
   */
  const loadMore = useCallback(async () => {
    if (!postId || isLoadingMore) return;

    const gen = genRef.current;
    const offset = loadedRef.current;
    setIsLoadingMore(true);
    try {
      const result = await api.get<CommentsListData>(`/posts/${postId}/comments`, {
        limit: pageSize,
        offset,
      });

      // 响应到达前列表已重置，丢弃过期数据
      if (genRef.current !== gen) return;
      setData((prev) => {
        const loaded = prev?.comments ?? [];

        // 按评论ID去重，避免重复插入
        const ids = new Set(loaded.map((c) => c.id));
        return {
          comments: [...loaded, ...result.comments.filter((c) => !ids.has(c.id))],
          total: result.total,
          hasMore: result.hasMore,
        };
      });
      loadedRef.current = offset + result.comments.length;
    } catch (err) {
      // 翻页失败以 toast 提示
      if (genRef.current === gen) notify.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [postId, isLoadingMore, pageSize]);

  /** 本地插入新评论到列表头部，并同步已加载数与总数 */
  const appendComment = useCallback((comment: Comment) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        comments: [comment, ...prev.comments],
        total: prev.total + 1,
        hasMore: prev.hasMore,
      };
    });
    loadedRef.current += 1;
  }, []);

  /** 本地替换指定评论（编辑后同步） */
  const replaceComment = useCallback((comment: Comment) => {
    setData((prev) =>
      prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === comment.id ? comment : c)) }
        : prev,
    );
  }, []);

  /** 本地移除指定评论，并同步已加载数与总数 */
  const removeComment = useCallback((commentId: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            comments: prev.comments.filter((c) => c.id !== commentId),
            total: Math.max(0, prev.total - 1),
          }
        : prev,
    );
    loadedRef.current = Math.max(0, loadedRef.current - 1);
  }, []);

  return {
    data,
    isLoading,
    isLoadingMore,
    isError,
    refetch,
    loadMore,
    appendComment,
    replaceComment,
    removeComment,
  };
}

/**
 * 创建评论 Hook
 * @param postId 文章ID
 * @returns 创建动作（mutate/isPending），成功/失败有 toast 提示
 */
export function useCreateComment(postId: string) {
  const action = useCallback(
    async (dto: CreateCommentDto) => {
      const result = await createCommentAction(postId, dto);
      return unwrap<Comment>(result);
    },
    [postId],
  );
  return useAsyncAction<CreateCommentDto, Comment>(action, {
    onSuccess: () => notify.created("comment"),
    onError: (err) => notify.error(err),
  });
}

/**
 * 更新评论 Hook
 * @returns 更新动作（mutate/isPending），入参为 { commentId, dto }
 */
export function useUpdateComment() {
  const action = useCallback(async ({ commentId, dto }: UpdateCommentMutationVars) => {
    const result = await updateCommentAction(commentId, dto);
    return unwrap<Comment>(result);
  }, []);
  return useAsyncAction<UpdateCommentMutationVars, Comment>(action, {
    onSuccess: () => notify.updated("comment"),
    onError: (err) => notify.error(err),
  });
}

/**
 * 删除评论 Hook
 * @returns 删除动作（mutate/isPending），入参为评论ID
 */
export function useDeleteComment() {
  const action = useCallback(async (commentId: string) => {
    const result = await deleteCommentAction(commentId);
    return unwrap<null>(result);
  }, []);
  return useAsyncAction<string, null>(action, {
    onSuccess: () => notify.deleted("comment"),
    onError: (err) => notify.error(err),
  });
}
