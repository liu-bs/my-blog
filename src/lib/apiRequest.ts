/**
 * @file apiRequest.ts
 * @description 浏览器端统一请求封装（只跑在客户端）：负责 URL 与查询参数拼装、超时中断、一次性网络重试、
 * 401 自动刷新令牌并重放、失败后跳转登录，以及统一响应体 `{ code, message, data }` 的判定
 */
import { ApiRequestError } from "@shared";
export { ApiRequestError };
import type { ApiResponse, RequestOptions, ValidationErrorDetail } from "@shared";
import { currentMsgLocale, msg } from "@/lib/message";

/** 单次请求（含刷新令牌请求）的超时时间，单位毫秒；超时会被 AbortController 中断并转为可重试的临时错误 */
const DEFAULT_TIMEOUT = 15_000;

/** 所有业务接口的统一前缀，后端 API Route 均挂在 /api 下 */
const BASE_URL = "/api";

/** 网络层失败后重试前的等待时间，单位毫秒；很短，仅用于避开瞬时抖动 */
const NET_RETRY_DELAY_MS = 400;

/**
 * 允许自动重试 HTTP 方法白名单
 * @description 只重试 GET/HEAD/OPTIONS 这类幂等、无副作用的「安全方法」：重发不会改变服务端状态；
 * 而 POST/PUT/DELETE 等写方法一旦请求已到达服务端只是响应丢失，重试就会造成重复下单式的脏数据，
 * 因此宁可失败让上层决定，也不做自动重试
 */
const SAFE_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 延时工具
 * @param ms 等待毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 拼接最终请求地址
 * @description 查询参数会丢弃 null / undefined / 空串，避免出现 `?q=` 这类无意义参数；统一用 URLSearchParams 编码
 * @param path 以 / 开头的业务路径（不含 /api 前缀）
 * @param query 查询参数对象
 * @returns 形如 `/api/posts?limit=10` 的完整地址；无有效参数时返回不带 ? 的地址
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

/** 登录跳转节流标记：为 true 表示刚从 401 跳到登录页，窗口内其他 401 不再重复跳转 */
let authRedirecting = false;

/** 上述节流窗口的定时器句柄，用于在重复触发时重置计时 */
let authRedirectTimer: ReturnType<typeof setTimeout> | null = null;

/** 刷新令牌的进行中 Promise；作为单例保证并发 401 只真正发起一次刷新 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * 刷新访问令牌
 * @description 用单例 Promise 去重：多个请求同时 401 时只有第一个真正发请求，其余复用同一结果；
 * 刷新成功后 httpOnly Cookie 由服务端重写，前端无需处理令牌本身；无论成功失败都在 finally 释放单例，避免失败后永久卡死
 * @returns 刷新成功（HTTP ok 且响应 code === 0）返回 true；网络异常、超时或返回体非成功一律 false
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
      // 刷新失败不抛错：由调用方决定是否跳登录
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * 发起一次请求
 * @description 关键设计：
 * 1) 超时：每个请求独立 AbortController 定时中断，并与调用方传入的 signal 合并，任一触发都中止；
 * 2) 网络重试：仅当失败并非调用方主动取消、且方法属于安全方法时重试一次（`_netRetried` 保证只重试一次）；
 * 3) 401 处理：先尝试刷新令牌，成功则重放原请求（`_retryDepth` 保证只重放一次，避免刷新后又 401 造成死循环），
 *    刷新失败则节流跳转到登录页并带上回跳地址；
 * 4) 成功判定：必须同时满足 HTTP ok 与响应体 `code === 0`，二者缺一视为失败
 * @param path 业务路径，不含 /api 前缀
 * @param options 请求配置，含 body/query/headers/method/signal 与 skipAuthRedirect 等 {@link RequestOptions}
 * @param _retryDepth 内部使用，401 刷新后重放的次数，用于防止无限重放，调用方不要传
 * @param _netRetried 内部使用，标记本次是否已做过网络重试，调用方不要传
 * @returns 成功时返回响应体中的 `data`
 * @throws {ApiRequestError} 超时、网络错误、非 2xx、响应体非 JSON 或 `code !== 0` 时抛出；主动取消会抛出 message 为 "Request aborted" 的错误
 * @warning 401 且刷新失败时会触发整页跳转（window.location.replace），因此调用方若需要自行处理未登录，应传 `skipAuthRedirect`
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
  // 合并超时信号与调用方信号：任一 abort 都能中止请求，便于组件卸载时取消
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

    // 只有调用方主动取消时才认为「不该重试」；超时中断仍属可重试的临时故障
    const isCallerAbort = isAbort && !!options.signal?.aborted;

    const isTransient = !isCallerAbort;

    // 临时故障 + 未重试过 + 安全方法，才重发一次
    if (isTransient && !_netRetried && SAFE_RETRY_METHODS.has(method)) {
      await sleep(NET_RETRY_DELAY_MS);
      return request<T>(path, options, _retryDepth, true);
    }

    if (isAbort) {
      if (isCallerAbort) {
        // 调用方主动取消：抛出可识别的错误，上层通常静默忽略
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
      // 2xx 之外的 HTML 错误页（如网关注入）也会走到这里，统一转为可读错误
      throw new ApiRequestError(
        res.status,
        res.status,
        msg("common", "requestFailed", { status: res.status }),
      );
    }
  }

  // 唯一成功条件：HTTP 成功且业务 code 为 0
  if (res.ok && payload && payload.code === 0) {
    return payload.data;
  }

  if (res.status === 401 && !skipAuthRedirect && _retryDepth < 1) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // 刷新成功，重放原请求；_retryDepth 递增保证最多重放一次
      return request<T>(path, options, _retryDepth + 1);
    }

    // 刷新失败：节流跳转，5s 窗口内的其他 401 不再触发跳转，避免并发请求导致多次跳转/闪烁
    if (!authRedirecting) {
      authRedirecting = true;

      if (authRedirectTimer) clearTimeout(authRedirectTimer);
      authRedirectTimer = setTimeout(() => {
        authRedirecting = false;
        authRedirectTimer = null;
      }, 5000);
      const currentPath = window.location.pathname + window.location.search;

      // 按当前语言前缀拼接登录地址，登录后可回到原页面
      const prefix = `/${currentMsgLocale()}`;
      window.location.replace(`${prefix}/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }

  // 兜底错误：优先用服务端 message，缺失时按状态码生成文案
  const message = payload?.message || msg("common", "requestFailed", { status: res.status });
  throw new ApiRequestError(res.status, payload?.code ?? res.status, message, payload?.details);
}

/**
 * API 门面：按方法暴露更简洁的调用方式
 */
export const api = {
  /**
   * GET 请求
   * @param path 业务路径，不含 /api 前缀
   * @param query 查询参数；null/undefined/空串会被丢弃
   * @param opts.skipAuthRedirect 传 true 时 401 不自动刷新/跳转，交由调用方处理
   * @param opts.revalidate 传入后启用 Next.js 缓存，单位秒（0 表示不缓存/每次校验）
   * @param opts.tags 缓存标签，配合 revalidate 用于按 tag 失效（revalidateTag）
   * @param opts.signal 外部取消信号
   * @returns 响应体中的 data
   * @warning 缓存选项仅当显式传入 revalidate 或非空 tags 时才会附加到 fetch 的 next 字段；
   * 不加 `next: {}` 是为了避免让普通 GET 意外被 Next.js 当作可缓存请求，从而读到过期数据
   */
  get: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts?: {
      /** 传 true 时 401 不做自动刷新与跳转 */
      skipAuthRedirect?: boolean;

      /** 缓存有效期（秒），设置后走 Next.js 缓存 */
      revalidate?: number;

      /** 缓存标签，配合 revalidateTag 定向失效 */
      tags?: string[];

      /** 外部取消信号 */
      signal?: AbortSignal;
    },
  ) => {
    const { revalidate, tags, ...rest } = opts ?? {};

    // 只有显式设置了缓存语义时才携带 next 选项
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
   * @param path 业务路径，不含 /api 前缀
   * @param body 请求体，会被 JSON 序列化；为 undefined 时不带 body
   * @param opts.skipAuthRedirect 传 true 时 401 不自动刷新/跳转
   * @returns 响应体中的 data
   */
  post: <T>(path: string, body?: unknown, opts?: { skipAuthRedirect?: boolean }) =>
    request<T>(path, { method: "POST", body, ...opts }),
};
