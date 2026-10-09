/**
 * @file apiRequest.ts
 * @description 浏览器端 REST 请求统一封装：注入 /api 前缀与凭据、15s 超时、GET 类请求瞬时网络错误单次重试、
 * 401 自动刷新 token 并重放（仅一次）、刷新失败统一跳转登录页（5s 内防抖去重）；另提供 Server Action 结果解包 unwrap。
 * 仅限客户端使用（依赖 window.location 与 cookie 会话）。
 */
import { ApiRequestError } from "@shared";
export { ApiRequestError };
import type { ApiResponse, ActionResult, RequestOptions, ValidationErrorDetail } from "@shared";
import { formatTemplate, messages } from "@/texts";

/** 请求默认超时时间（含刷新 token 请求），单位ms，超时经 AbortController 中断 */
const DEFAULT_TIMEOUT = 15_000;

/** REST 接口基础前缀 */
const BASE_URL = "/api";

/** 瞬时网络错误重试前的等待时长，单位ms */
const NET_RETRY_DELAY_MS = 400;

/** 幂等可安全重试的方法集合（重试不会造成重复副作用） */
const SAFE_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 延时工具
 * @param ms 等待毫秒数
 * @returns 在 ms 后 resolve 的 Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 拼接带查询串的完整请求 URL
 * @param path 以 / 开头的接口路径（相对 /api）
 * @param query 查询参数对象，null/undefined/空串值会被剔除
 * @returns 形如 /api/posts?page=2 的 URL；无有效参数时不带 ?
 */
function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // 过滤空值，避免产生 ?a=&b= 的脏查询串
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** 全局跳登录标记：多请求同时 401 时只跳转一次 */
let authRedirecting = false;

/** 跳登录标记的复位定时器，5s 后允许再次触发跳转 */
let authRedirectTimer: ReturnType<typeof setTimeout> | null = null;

/** 进行中的刷新 Promise，并发 401 共享同一次刷新请求（单飞/去重） */
let refreshPromise: Promise<boolean> | null = null;

/**
 * 尝试刷新登录态（POST /api/auth/refresh）
 * @returns 刷新成功（响应 code===0）返回 true，网络失败/非 2xx/超时返回 false
 * @warning 并发调用复用同一 Promise，避免同时发起多次刷新请求
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
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * 核心请求方法
 * @param path 接口路径（相对 /api）
 * @param options 请求配置；额外支持 query（查询参数）、body（自动 JSON 序列化）、skipAuthRedirect（401 不跳登录）
 * @param _retryDepth 内部参数：401 刷新后重放的递归深度，最多 1 次
 * @param _netRetried 内部参数：是否已做过瞬时网络重试
 * @returns 响应信封中 code===0 时的 data 字段
 * @throws ApiRequestError：status 0 表示网络错误/超时/主动中止；HTTP 或业务 code 非 0 时携带服务端 message 与校验 details
 * @warning 401 且刷新失败时会 window.location.replace 整页跳转登录页（携带当前路径回跳参数）
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

  // 合并调用方 signal 与超时 signal：任一触发即中断
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

    // 区分调用方主动取消与超时中断
    const isCallerAbort = isAbort && !!options.signal?.aborted;

    // 非调用方主动取消（含超时、断网）视为瞬时故障
    const isTransient = !isCallerAbort;

    // 幂等方法允许一次瞬时网络重试（等待 400ms 后重放）
    if (isTransient && !_netRetried && SAFE_RETRY_METHODS.has(method)) {
      await sleep(NET_RETRY_DELAY_MS);
      return request<T>(path, options, _retryDepth, true);
    }

    if (isAbort) {
      if (isCallerAbort) {
        throw new ApiRequestError(0, 0, "Request aborted");
      }
      throw new ApiRequestError(0, 0, messages.feedback.common.timeout);
    }

    throw new ApiRequestError(0, 0, messages.feedback.common.networkError);
  } finally {
    clearTimeout(timeoutId);
  }

  // 先取文本再手动解析：兼容空响应体与非 JSON 响应
  let payload: (ApiResponse<T> & { details?: ValidationErrorDetail[] }) | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiRequestError(
        res.status,
        res.status,
        formatTemplate(messages.feedback.common.requestFailed, { status: res.status }),
      );
    }
  }

  // 唯一成功判定：HTTP 2xx 且业务 code === 0
  if (res.ok && payload && payload.code === 0) {
    return payload.data;
  }

  // 401 处理：先尝试刷新 token 重放一次；刷新失败则全局跳登录
  if (res.status === 401 && !skipAuthRedirect && _retryDepth < 1) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, _retryDepth + 1);
    }

    // 5s 窗口内仅跳转一次，防止并发 401 引发多次整页跳转
    if (!authRedirecting) {
      authRedirecting = true;

      if (authRedirectTimer) clearTimeout(authRedirectTimer);
      authRedirectTimer = setTimeout(() => {
        authRedirecting = false;
        authRedirectTimer = null;
      }, 5000);
      const currentPath = window.location.pathname + window.location.search;

      window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }

  const message =
    payload?.message ||
    formatTemplate(messages.feedback.common.requestFailed, { status: res.status });
  throw new ApiRequestError(res.status, payload?.code ?? res.status, message, payload?.details);
}

/** REST 请求便捷方法集合，基于 {@link request} */
export const api = {
  /**
   * GET 请求
   * @param path 接口路径
   * @param query 查询参数（空值自动剔除）
   * @param opts 可选：skipAuthRedirect 关闭 401 自动跳登录；signal 外部中止信号
   */
  get: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts?: { skipAuthRedirect?: boolean; signal?: AbortSignal },
  ) =>
    request<T>(path, {
      method: "GET",
      query,
      ...opts,
    }),

  /**
   * POST 请求
   * @param path 接口路径
   * @param body 请求体，自动 JSON 序列化
   * @param opts 可选：skipAuthRedirect 关闭 401 自动跳登录
   */
  post: <T>(path: string, body?: unknown, opts?: { skipAuthRedirect?: boolean }) =>
    request<T>(path, { method: "POST", body, ...opts }),
};

/**
 * 解包 Server Action 返回的 ActionResult 信封
 * @param result ActionResult，ok 为 false 时含 status/message/details
 * @returns 成功时的业务数据
 * @throws ApiRequestError 失败时以 ActionResult 的 status 与 message 抛出，供 hooks 层统一 catch
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ApiRequestError(result.status, result.status, result.message, result.details as never);
}
