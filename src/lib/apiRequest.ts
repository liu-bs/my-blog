/**
 * @file apiRequest.ts
 * @description 客户端 fetch 封装：统一 /api 前缀、15s 超时与 JSON 序列化，响应按 ApiResponse 协议拆箱；401 时静默刷新 token 并重试一次，刷新失败跳转登录页；安全方法的网络错误自动重试一次；失败统一抛出携带 status/code/message/details 的 ApiRequestError
 */
import { ApiRequestError } from "@shared";
export { ApiRequestError };
import type { ApiResponse, RequestOptions, ValidationErrorDetail } from "@shared";
import { currentMsgLocale, msg } from "@/lib/message";

/** 请求超时时间，单位ms */
const DEFAULT_TIMEOUT = 15_000;

/** 接口基础路径前缀 */
const BASE_URL = "/api";

/** 网络错误重试延迟，单位ms */
const NET_RETRY_DELAY_MS = 400;

/** 允许网络失败自动重试的安全方法（幂等请求） */
const SAFE_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 拼接接口完整 URL，查询参数跳过 null/undefined/空串
 * @param path 接口路径
 * @param query 查询参数
 * @returns 完整请求路径
 */
function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** 登录跳转去重标记，避免并发 401 触发多次跳转 */
let authRedirecting = false;

/** 登录跳转去重的重置定时器 */
let authRedirectTimer: ReturnType<typeof setTimeout> | null = null;

/** 进行中的刷新请求共享 Promise，合并并发刷新 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * 尝试刷新登录 token（POST /api/auth/refresh），并发调用共享同一请求
 * @returns 是否刷新成功
 */
async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return false;
      const payload = await res.json();
      return payload?.code === 0;
    } catch {
      // 刷新异常按刷新失败处理
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * 发起接口请求并拆箱响应数据
 * @param path 接口路径
 * @param options 请求配置（方法、查询、请求体、请求头等）
 * @param _retryDepth 401 刷新后的重试深度，内部使用
 * @param _netRetried 网络错误是否已重试过，内部使用
 * @returns 响应 data 字段
 * @throws 超时、网络失败、非 0 业务码或 JSON 解析失败时抛出 ApiRequestError
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
  _retryDepth = 0,
  _netRetried = false,
): Promise<T> {
  const { body, query, headers, skipAuthRedirect, ...rest } = options;

  const method = (rest.method ?? "GET").toUpperCase();
  const url = buildUrl(path, query);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const combinedSignal = rest.signal
    ? AbortSignal.any([rest.signal, controller.signal])
    : controller.signal;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: combinedSignal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";

    const isCallerAbort = isAbort && !!options.signal?.aborted;

    const isTransient = !isCallerAbort;

    if (isTransient && !_netRetried && SAFE_RETRY_METHODS.has(method)) {
      await sleep(NET_RETRY_DELAY_MS);
      return request<T>(path, options, _retryDepth, true);
    }

    if (isAbort) {
      if (isCallerAbort) {
        // 调用方主动中止（如组件卸载），非超时
        throw new ApiRequestError(0, 0, "Request aborted");
      }
      throw new ApiRequestError(0, 0, msg("common", "timeout"));
    }

    throw new ApiRequestError(0, 0, msg("common", "networkError"));
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: (ApiResponse<T> & { details?: ValidationErrorDetail[] }) | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // 非 JSON 响应按请求失败处理
      throw new ApiRequestError(
        res.status,
        res.status,
        msg("common", "requestFailed", { status: res.status }),
      );
    }
  }

  if (res.ok && payload && payload.code === 0) {
    return payload.data;
  }

  if (res.status === 401 && !skipAuthRedirect && _retryDepth < 1) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // 刷新成功后重放原请求（仅一次）
      return request<T>(path, options, _retryDepth + 1);
    }

    if (!authRedirecting) {
      authRedirecting = true;

      // 5 秒内只允许触发一次登录跳转
      if (authRedirectTimer) clearTimeout(authRedirectTimer);
      authRedirectTimer = setTimeout(() => {
        authRedirecting = false;
        authRedirectTimer = null;
      }, 5000);
      const currentPath = window.location.pathname + window.location.search;

      const prefix = `/${currentMsgLocale()}`;
      window.location.replace(`${prefix}/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }

  const message = payload?.message || msg("common", "requestFailed", { status: res.status });
  throw new ApiRequestError(res.status, payload?.code ?? res.status, message, payload?.details);
}

/**
 * 便捷请求方法集合
 */
export const api = {
  /**
   * GET 请求
   * @param path 接口路径
   * @param query 查询参数
   * @param opts 可选项：skipAuthRedirect 跳过 401 刷新与登录跳转；revalidate/tags 供服务端渲染缓存使用；signal 外部中止信号
   */
  get: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts?: {
      /** 为 true 时 401 不触发刷新重试与登录跳转 */
      skipAuthRedirect?: boolean;

      /** 服务端缓存有效期，秒 */
      revalidate?: number;

      /** 服务端缓存标签 */
      tags?: string[];

      /** 外部中止信号 */
      signal?: AbortSignal;
    },
  ) => {
    const { revalidate, tags, ...rest } = opts ?? {};

    const hasNextOpts = revalidate !== undefined || (tags?.length ?? 0) > 0;
    return request<T>(path, {
      method: "GET",
      query,
      ...rest,
      ...(hasNextOpts
        ? { next: { revalidate: revalidate ?? 0, ...(tags?.length ? { tags } : {}) } }
        : {}),
    });
  },

  /**
   * POST 请求
   * @param path 接口路径
   * @param body 请求体
   * @param opts 可选项：skipAuthRedirect 跳过 401 刷新与登录跳转
   */
  post: <T>(path: string, body?: unknown, opts?: { skipAuthRedirect?: boolean }) =>
    request<T>(path, { method: "POST", body, ...opts }),
};
