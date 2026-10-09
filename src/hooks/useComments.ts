/**
 * @file useComments.ts
 * @description 评论区数据与操作 Hooks：useComments 负责文章评论分页列表（首屏 SSR 种子、加载更多、本地增删改同步），
 * useCreateComment / useUpdateComment / useDeleteComment 封装评论服务端 Action 并自动弹出 toast 反馈。仅限客户端使用。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/toast";
import { unwrap } from "@/lib/apiRequest";
import {
  createCommentAction,
  updateCommentAction,
  deleteCommentAction,
} from "@server/comment/comment.controller";
import { api } from "@/lib/apiRequest";
import { COMMENT_PAGE_SIZE } from "@/config/site";
import type {
  Comment,
  CommentsListData,
  CreateCommentDto,
  UpdateCommentMutationVars,
} from "@shared";

/**
 * 文章评论列表 Hook
 * @param postId 文章 ID，为空时不发起请求
 * @param initialData SSR 首屏数据；存在时跳过首次请求直接种子渲染
 * @param pageSize 每页条数，默认 COMMENT_PAGE_SIZE（10）
 * @returns 评论列表状态与操作方法，见下方返回结构
 * @warning postId 变化会清空已加载进度并重新请求第一页
 */
export function useComments(
  postId: string,
  initialData: CommentsListData | null = null,
  pageSize = COMMENT_PAGE_SIZE,
) {
  const [data, setData] = useState<CommentsListData | null>(initialData);
  const [isLoading, setIsLoading] = useState(!!postId && !initialData);
  /** 是否正在加载下一页 */
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);

  /** 自增计数器，变更即触发列表重新请求（refetch 的实现载体） */
  const [tick, setTick] = useState(0);

  /** 已加载的评论条数，作为分页 offset */
  const loadedRef = useRef(initialData?.comments.length ?? 0);

  /** 请求代际号：每次整表重新加载自增，用于丢弃过期 loadMore 响应 */
  const genRef = useRef(0);

  /** 记录已被 initialData 种子化的 postId，该文章首次 effect 跳过请求 */
  const seededForRef = useRef(initialData ? postId : null);

  /** 触发列表刷新（重置为第一页） */
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // 首屏/刷新请求：监听 postId、tick、pageSize 变化重新拉取第一页
  useEffect(() => {
    if (!postId) return;

    // SSR 种子数据对应当前文章时，消费掉种子标记并跳过本次请求
    if (seededForRef.current === postId) {
      seededForRef.current = null;
      return;
    }

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
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    // 卸载/依赖变更时取消进行中的请求，避免过期响应写入 state
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postId, tick, pageSize]);

  /**
   * 加载下一页评论并追加到列表
   * 按 id 去重合并；期间若发生整表刷新（代际号变化）则丢弃本批结果
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

      // 响应返回时代际已变（列表被重刷），丢弃这批数据
      if (genRef.current !== gen) return;
      setData((prev) => {
        const loaded = prev?.comments ?? [];

        // 过滤掉已存在的评论 id，防止服务端数据重叠导致重复渲染
        const ids = new Set(loaded.map((c) => c.id));
        return {
          comments: [...loaded, ...result.comments.filter((c) => !ids.has(c.id))],
          total: result.total,
          hasMore: result.hasMore,
        };
      });
      loadedRef.current = offset + result.comments.length;
    } catch (err) {
      // 仅当前代际的失败才提示，过期请求的错误静默
      if (genRef.current === gen) notify.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [postId, isLoadingMore, pageSize]);

  /** 新评论插入列表头部（乐观更新/创建成功后本地同步），total 加 1 */
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

  /** 按 id 原地替换评论（编辑成功后本地同步） */
  const replaceComment = useCallback((comment: Comment) => {
    setData((prev) =>
      prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === comment.id ? comment : c)) }
        : prev,
    );
  }, []);

  /** 按 id 移除评论（删除成功后本地同步），total 减 1 且不小于 0 */
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
    /** 当前评论列表数据（含 total、hasMore），未加载时为 initialData 或 null */
    data,
    /** 首屏/刷新加载中 */
    isLoading,
    /** 下一页加载中 */
    isLoadingMore,
    /** 首屏/刷新请求是否失败 */
    isError,
    /** 手动触发重新请求第一页 */
    refetch,
    /** 加载下一页并追加 */
    loadMore,
    /** 本地插入新评论到头部 */
    appendComment,
    /** 本地替换已编辑的评论 */
    replaceComment,
    /** 本地移除已删除的评论 */
    removeComment,
  };
}

/**
 * 创建评论 Mutation Hook
 * @param postId 目标文章 ID
 * @returns {@link useAsyncAction} 结构，mutate(dto) 成功后自动弹出"已创建" toast 并返回新 Comment
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
 * 更新评论 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate({ commentId, dto }) 成功后自动弹出"已更新" toast 并返回更新后的 Comment
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
 * 删除评论 Mutation Hook
 * @returns {@link useAsyncAction} 结构，mutate(commentId) 成功后自动弹出"已删除" toast，返回 null
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
