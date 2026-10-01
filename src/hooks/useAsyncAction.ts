/**
 * @file useAsyncAction.ts
 * @description 通用异步动作 Hook：封装 mutate/isPending，同一时刻仅允许一个请求在途；可选对超时/网络/限流类错误做指数退避重试，成功/失败/完结回调支持调用处覆盖默认值
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 异步动作回调集合
 */
interface MutationCallbacks<TData> {
  /** 成功回调，入参为动作返回数据 */
  onSuccess?: (data: TData) => void;

  /** 失败回调，入参为归一化后的 Error */
  onError?: (err: Error) => void;

  /** 完结回调，无论成败都会执行 */
  onSettled?: () => void;
}

/** 重试基础延迟，单位ms，按次数指数退避 */
const RETRY_BASE_DELAY = 1_000;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/**
 * 判断错误是否可重试（超时/网络/限流类），主动中止不重试
 * @param err 待判断的错误
 * @returns 是否可重试
 */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return false;

  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    return status === 408 || status === 429 || status === 0;
  }

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
 * 异步动作对外接口
 */
interface AsyncAction<TVars, TData> {
  /** 触发动作；已有请求在途时忽略本次调用并返回 undefined */
  mutate: (vars: TVars, callbacks?: MutationCallbacks<TData>) => Promise<TData | undefined>;

  /** 是否有请求在途 */
  isPending: boolean;
}

/**
 * 通用异步动作 Hook
 * @param action 实际执行的异步函数
 * @param defaults 默认成功/失败/完结回调，调用处可在 mutate 时覆盖
 * @param retry 是否对可重试错误做指数退避重试
 * @returns mutate 触发函数与 isPending 状态，失败时 mutate 返回 undefined
 */
export function useAsyncAction<TVars, TData>(
  action: (vars: TVars) => Promise<TData>,
  defaults?: MutationCallbacks<TData>,
  retry = false,
): AsyncAction<TVars, TData> {
  const [isPending, setIsPending] = useState(false);

  /** 在途标记，防止并发重复提交 */
  const mutatingRef = useRef(false);

  /** 默认回调缓存，避免 mutate 依赖频繁变化 */
  const defaultsRef = useRef(defaults);

  /** 每次渲染同步最新默认回调到 ref */
  useEffect(() => {
    defaultsRef.current = defaults;
  });

  const mutate = useCallback(
    async (vars: TVars, callbacks?: MutationCallbacks<TData>) => {
      // 同一时刻仅允许一个请求在途
      if (mutatingRef.current) return undefined;
      mutatingRef.current = true;
      setIsPending(true);

      try {
        let attempt = 0;

        // 重试循环，仅对可重试错误生效
        while (true) {
          try {
            const data = await action(vars);

            (callbacks?.onSuccess ?? defaultsRef.current?.onSuccess)?.(data);
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));

            if (!retry || !isRetryableError(error) || attempt >= MAX_RETRIES) {
              (callbacks?.onError ?? defaultsRef.current?.onError)?.(error);
              return undefined;
            }

            const delay = RETRY_BASE_DELAY * 2 ** attempt;
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
            attempt++;
          }
        }
      } finally {
        // 无论成败，恢复状态并触发完结回调
        mutatingRef.current = false;
        setIsPending(false);
        (callbacks?.onSettled ?? defaultsRef.current?.onSettled)?.();
      }
    },
    [action, retry],
  );

  return { mutate, isPending };
}
