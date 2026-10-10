import { ApiRequestError } from "@shared";
export { ApiRequestError };
import type { ApiResponse, ActionResult, RequestOptions, ValidationErrorDetail } from "@shared";
import feedback from "@/texts/feedback";
import { formatTemplate } from "@/texts/format";

const DEFAULT_TIMEOUT = 15_000;

const BASE_URL = "/api";

const NET_RETRY_DELAY_MS = 400;

const SAFE_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

let isRedirectingToLogin = false;

let loginRedirectResetTimer: ReturnType<typeof setTimeout> | null = null;

let refreshPromise: Promise<boolean> | null = null;

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

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  retryDepth = 0,
  hasRetriedNetwork = false,
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

    if (isTransient && !hasRetriedNetwork && SAFE_RETRY_METHODS.has(method)) {
      await sleep(NET_RETRY_DELAY_MS);
      return apiRequest<T>(path, options, retryDepth, true);
    }

    if (isAbort) {
      if (isCallerAbort) {
        throw new ApiRequestError(0, 0, "Request aborted");
      }
      throw new ApiRequestError(0, 0, feedback.common.timeout);
    }

    throw new ApiRequestError(0, 0, feedback.common.networkError);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: (ApiResponse<T> & { details?: ValidationErrorDetail[] }) | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiRequestError(
        res.status,
        res.status,
        formatTemplate(feedback.common.requestFailed, { status: res.status }),
      );
    }
  }

  if (res.ok && payload && payload.code === 0) {
    return payload.data;
  }

  if (res.status === 401 && !skipAuthRedirect && retryDepth < 1) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiRequest<T>(path, options, retryDepth + 1);
    }

    if (!isRedirectingToLogin) {
      isRedirectingToLogin = true;

      if (loginRedirectResetTimer) clearTimeout(loginRedirectResetTimer);
      loginRedirectResetTimer = setTimeout(() => {
        isRedirectingToLogin = false;
        loginRedirectResetTimer = null;
      }, 5000);
      const currentPath = window.location.pathname + window.location.search;

      window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }

  const message =
    payload?.message || formatTemplate(feedback.common.requestFailed, { status: res.status });
  throw new ApiRequestError(res.status, payload?.code ?? res.status, message, payload?.details);
}

export const api = {
  get: <T>(
    path: string,
    query?: RequestOptions["query"],
    opts?: { skipAuthRedirect?: boolean; signal?: AbortSignal },
  ) =>
    apiRequest<T>(path, {
      method: "GET",
      query,
      ...opts,
    }),

  post: <T>(path: string, body?: unknown, opts?: { skipAuthRedirect?: boolean }) =>
    apiRequest<T>(path, { method: "POST", body, ...opts }),
};

export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ApiRequestError(result.status, result.status, result.message, result.details as never);
}
