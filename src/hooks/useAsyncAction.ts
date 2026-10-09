/**
 * @file useAsyncAction.ts
 * @description 异步操作（mutation）通用 Hook，封装 pending 状态、防并发重入、可选指数退避重试与成功/失败/结束回调；
 * 供帖子、评论、点赞等服务端 Action 调用方复用。仅限客户端组件使用（"use client"）。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 异步操作生命周期回调集合
 */
interface MutationCallbacks<TData> {
  /** 成功回调，参数为 action 解析后的数据 */
  onSuccess?: (data: TData) => void;

  /** 失败回调，参数为归一化后的 Error（非 Error 抛出物会被包装） */
  onError?: (err: Error) => void;

  /** 结束回调，无论成功/失败/重试耗尽都会执行（finally 语义） */
  onSettled?: () => void;
}

/** 重试基础延迟，单位ms；实际延迟为 基础延迟 * 2^尝试次数 的指数退避 */
const RETRY_BASE_DELAY = 1_000;

/** 可重试错误的最大重试次数 */
const MAX_RETRIES = 3;

/**
 * 判断错误是否值得重试
 * @param err 捕获的抛出物
 * @returns 仅网络超时/中断类错误（408、429、status 0，或消息含 timeout/network/failed to fetch）返回 true；
 * AbortError（调用方主动取消）与不可识别错误返回 false
 */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // 调用方主动 abort 的请求不重试
  if (err.name === "AbortError") return false;

  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    // 408 请求超时 / 429 限流 / 0 网络层错误，均视为瞬时故障
    return status === 408 || status === 429 || status === 0;
  }

  // 无结构化 status 时退化为消息文本匹配
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("408") ||
    msg.includes("429")
  );
}

/**
 * 单次异步操作的返回结构
 */
interface AsyncAction<TVars, TData> {
  /**
   * 触发异步操作。同一时刻仅允许一个进行中的调用：
   * 若上一次 mutate 尚未结束，本次调用直接返回 undefined 而不重复执行
   * @param vars 操作入参
   * @param callbacks 本次调用专属回调，优先级高于 Hook 级 defaults
   * @returns 成功时返回数据；失败/被并发拦截时返回 undefined（不向外抛错）
   */
  mutate: (vars: TVars, callbacks?: MutationCallbacks<TData>) => Promise<TData | undefined>;

  /** 是否有进行中的操作，可用于禁用按钮 */
  isPending: boolean;
}

/**
 * 异步操作 Hook
 * @param action 实际执行的异步函数，入参为 vars
 * @param defaults Hook 级默认回调（引用每次渲染自动同步，无需 memo）
 * @param retry 是否启用指数退避重试（默认 false）；重试间隔 1s、2s、4s，最多 3 次
 * @returns mutate 触发方法与 isPending 加载状态
 * @warning action 引用变化会导致 mutate 重建，调用方通常需用 useCallback 包裹 action
 */
export function useAsyncAction<TVars, TData>(
  action: (vars: TVars) => Promise<TData>,
  defaults?: MutationCallbacks<TData>,
  retry = false,
): AsyncAction<TVars, TData> {
  const [isPending, setIsPending] = useState(false);

  /** 并发锁标记，防止同一操作重入 */
  const mutatingRef = useRef(false);

  /** 始终持有最新的 defaults，避免 mutate 因回调引用变化而重建 */
  const defaultsRef = useRef(defaults);

  useEffect(() => {
    defaultsRef.current = defaults;
  });

  const mutate = useCallback(
    async (vars: TVars, callbacks?: MutationCallbacks<TData>) => {
      // 已有进行中的操作时直接丢弃本次调用
      if (mutatingRef.current) return undefined;
      mutatingRef.current = true;
      setIsPending(true);

      try {
        let attempt = 0;

        // 重试循环：成功或耗尽重试次数/遇到不可重试错误后退出
        while (true) {
          try {
            const data = await action(vars);

            // 本次调用回调优先，缺省时回退到 Hook 级 defaults
            (callbacks?.onSuccess ?? defaultsRef.current?.onSuccess)?.(data);
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));

            // 未启用重试 / 不可重试 / 已达最大次数：走失败回调并返回 undefined
            if (!retry || !isRetryableError(error) || attempt >= MAX_RETRIES) {
              (callbacks?.onError ?? defaultsRef.current?.onError)?.(error);
              return undefined;
            }

            // 指数退避：延迟 = 1000ms * 2^attempt
            const delay = RETRY_BASE_DELAY * 2 ** attempt;
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
            attempt++;
          }
        }
      } finally {
        mutatingRef.current = false;
        setIsPending(false);
        (callbacks?.onSettled ?? defaultsRef.current?.onSettled)?.();
      }
    },
    [action, retry],
  );

  return { mutate, isPending };
}
