/**
 * @file useComments.ts
 * @description 文章评论列表与评论增删改的 Hook 集合：列表部分负责首屏加载、分页追加、竞态取消与本地增删改同步；
 * 增删改部分复用 useAsyncAction，统一带成功/失败 toast
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

/** 评论列表默认每页条数 */
export const COMMENTS_PAGE_SIZE = 10;

/**
 * 评论列表 Hook，按文章 id 加载评论并支持分页与本地增删改
 * @description 竞态处理：用 genRef 作为「代次号」，每次重新加载（postId/tick/pageSize 变化）都自增，
 * 使此前发起、尚未返回的 loadMore 结果作废，避免旧数据被追加到新列表里；首屏请求额外用 AbortController 真正中断网络请求
 * @param postId 文章 id；为空时视为无评论可加载，不发起任何请求
 * @param pageSize 每页条数，默认 {@link COMMENTS_PAGE_SIZE}；变更会触发首屏重新加载
 * @returns 列表数据与操作方法的集合
 * @returns data 评论列表数据（含 comments/total/hasMore），加载前为 null
 * @returns isLoading 首屏加载中（初次进入或 refetch 触发）
 * @returns isLoadingMore 正在追加下一页
 * @returns isError 首屏加载失败标记（用于展示重试入口）；加载更多失败只弹 toast、不置此标记
 * @returns refetch 重新拉取第一页并重置已加载条数
 * @returns loadMore 追加下一页；已加载全部或正在追加时为空操作
 * @returns appendComment 发表成功后把新评论插入列表头部并同步计数
 * @returns replaceComment 编辑成功后按 id 原地替换
 * @returns removeComment 删除成功后移除并修正总数与已加载计数
 */
export function useComments(postId: string, pageSize = COMMENTS_PAGE_SIZE) {
  const [data, setData] = useState<CommentsListData | null>(null);
  const [isLoading, setIsLoading] = useState(!!postId);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  /** 变更即触发重新加载的计数器，refetch 通过自增它来复用同一套加载逻辑 */
  const [tick, setTick] = useState(0);

  /** 当前已加载的评论条数，作为 loadMore 的 offset 基准；与 data 分开维护以免依赖 state 更新时序 */
  const loadedRef = useRef(0);

  /** 加载代次号，用于判定异步结果是否已过期（竞态取消） */
  const genRef = useRef(0);

  /** 触发首屏重新加载 */
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!postId) return;
    // 代次自增：让所有在途的 loadMore 结果失效
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
        // 被 abort（如快速切换文章）时不计为错误
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      // 清理：标记作废并中断尚未完成的请求，防止卸载后 setState 与错序写入
      cancelled = true;
      controller.abort();
    };
  }, [postId, tick, pageSize]);

  /** 追加下一页评论 */
  const loadMore = useCallback(async () => {
    if (!postId || isLoadingMore) return;
    // 记录发起时的代次与 offset，返回后据此判断是否仍有效
    const gen = genRef.current;
    const offset = loadedRef.current;
    setIsLoadingMore(true);
    try {
      const result = await api.get<CommentsListData>(`/posts/${postId}/comments`, {
        limit: pageSize,
        offset,
      });
      // 期间列表已被重置/重载，则丢弃本次结果
      if (genRef.current !== gen) return;
      setData((prev) => ({
        comments: [...(prev?.comments ?? []), ...result.comments],
        total: result.total,
        hasMore: result.hasMore,
      }));
      loadedRef.current = offset + result.comments.length;
    } catch (err) {
      // 仅在结果仍有效时提示，避免给用户看已过期请求的错误
      if (genRef.current === gen) notify.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [postId, isLoadingMore, pageSize]);

  /** 发表成功后本地插入新评论（服务端按时间倒序返回，故插入头部） */
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

  /** 编辑成功后按 id 替换对应评论 */
  const replaceComment = useCallback((comment: Comment) => {
    setData((prev) =>
      prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === comment.id ? comment : c)) }
        : prev,
    );
  }, []);

  /** 删除成功后移除该评论并修正总数与已加载计数（下限为 0） */
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
 * 发表评论 Hook
 * @param postId 目标文章 id
 * @returns mutation，成功时 toast「评论已发布」，失败时统一错误提示；返回值即新建的评论
 * @warning 本 Hook 不会自动刷新列表，调用方需在 onSuccess 中用 appendComment 同步本地列表
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
 * 编辑评论 Hook
 * @returns mutation，入参为 { commentId, dto }，成功时 toast「评论已更新」；调用方需用 replaceComment 同步列表
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
 * @returns mutation，入参为评论 id，成功时 toast「评论已删除」；调用方需用 removeComment 同步列表
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
