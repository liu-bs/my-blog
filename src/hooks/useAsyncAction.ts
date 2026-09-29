/**
 * @file useAsyncAction.ts
 * @description 异步写操作（mutation）通用 Hook：把一次调用收敛为「pending 状态 + 成功/失败/结束回调」，
 * 并可选地做指数退避重试。全站的创建/更新/删除、点赞、登出等都基于它，避免每个页面各写一套 loading 与提示逻辑
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 一次 mutation 的生命周期回调
 * @description 三者的优先级规则相同：调用 mutate 时传入的回调覆盖 Hook 初始化时的默认回调
 */
interface MutationCallbacks<TData> {
  /** 成功回调，入参为 action 的返回值 */
  onSuccess?: (data: TData) => void;

  /** 失败回调，入参为归一化后的 Error；在这里做错误提示 */
  onError?: (err: Error) => void;

  /** 无论成功失败都会执行，用于关闭弹窗、重置表单等收尾动作 */
  onSettled?: () => void;
}

/** 重试基础间隔，单位毫秒；第 n 次重试等待 RETRY_BASE_DELAY * 2^n */
const RETRY_BASE_DELAY = 1_000;

/** 单次 mutate 内允许的最大重试次数，超过后直接走失败分支 */
const MAX_RETRIES = 3;

/**
 * 判断错误是否值得重试
 * @description 只重试「临时性」故障：主动取消（AbortError）永不重试，避免用户离开页面后仍在后台重发请求；
 * 显式状态码只认 408（请求超时）、429（限流）、0（网络层失败）；无状态码时退化为按错误文案关键字匹配，
 * 以覆盖 fetch 抛出的 TypeError 等场景
 * @param err 待判定的错误对象
 * @returns 可重试返回 true
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
 * useAsyncAction 的返回值
 */
interface AsyncAction<TVars, TData> {
  /** 触发一次异步操作；不会 reject，失败时返回 undefined 并交给 onError */
  mutate: (vars: TVars, callbacks?: MutationCallbacks<TData>) => Promise<TData | undefined>;

  /** 是否有一次 mutate 正在执行（含重试等待期间） */
  isPending: boolean;
}

/**
 * 把异步 action 包装成带 pending 状态与生命周期回调的 mutation
 * @description 并发模型：同一时刻只允许一次 mutate 在途，重复调用会被直接丢弃并返回 undefined（而非排队或覆盖），
 * 防止用户连点造成重复提交；状态收敛模型：无论成功、失败还是被重试耗尽，最终都会执行 onSettled 并复位 isPending，调用方无需自行清理
 * @param action 实际执行的异步函数，入参为 mutate 传入的 vars
 * @param defaults 默认回调；每次渲染都会同步到 ref，因此回调里可安全引用最新闭包，不需要调用方自己 useCallback
 * @param retry 是否开启失败自动重试，默认关闭；开启后按指数退避重试，仅对 isRetryableError 认定为临时的错误生效
 * @returns mutate 方法与 isPending 状态 {@link AsyncAction}
 * @example
 * const { mutate, isPending } = useAsyncAction(savePost, { onError: (e) => notify.error(e) });
 * <Button loading={isPending} onClick={() => mutate(dto)}>保存</Button>
 * @warning mutate 只暴露 Promise 而不抛出异常，若调用方需要感知失败，必须通过 onError 或 await 后判空
 */
export function useAsyncAction<TVars, TData>(
  action: (vars: TVars) => Promise<TData>,
  defaults?: MutationCallbacks<TData>,
  retry = false,
): AsyncAction<TVars, TData> {
  const [isPending, setIsPending] = useState(false);

  /** 在途标记：用 ref 而非 state，保证同一事件循环内的连续调用能同步判重，不受 React 批处理影响 */
  const mutatingRef = useRef(false);

  /** 默认回调的实时引用，规避闭包陈旧问题 */
  const defaultsRef = useRef(defaults);
  /** 每次渲染后同步最新回调，依赖数组故意留空以在所有渲染后都执行 */
  useEffect(() => {
    defaultsRef.current = defaults;
  });

  const mutate = useCallback(
    async (vars: TVars, callbacks?: MutationCallbacks<TData>) => {
      // 已在途则丢弃本次调用，实现「按钮级」防重复提交
      if (mutatingRef.current) return undefined;
      mutatingRef.current = true;
      setIsPending(true);

      try {
        let attempt = 0;
        // 无限循环 + 内部 return，保证 try/finally 一定覆盖所有退出路径
        while (true) {
          try {
            const data = await action(vars);

            (callbacks?.onSuccess ?? defaultsRef.current?.onSuccess)?.(data);
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));

            // 未开启重试、错误不可重试、或已用尽次数时，收敛为失败
            if (!retry || !isRetryableError(error) || attempt >= MAX_RETRIES) {
              (callbacks?.onError ?? defaultsRef.current?.onError)?.(error);
              return undefined;
            }

            // 指数退避：1s、2s、4s
            const delay = RETRY_BASE_DELAY * 2 ** attempt;
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
            attempt++;
          }
        }
      } finally {
        // 无论成功/失败/重试耗尽，都在此统一复位，保证状态不会卡在 pending
        mutatingRef.current = false;
        setIsPending(false);
        (callbacks?.onSettled ?? defaultsRef.current?.onSettled)?.();
      }
    },
    [action, retry],
  );

  return { mutate, isPending };
}
