import "server-only";

export interface RateLimitPolicy {
  limit: number;

  windowMs: number;

  message?: string;
}

const MINUTE_MS = 60_000;

const RETRY_IN_5_MINUTES = "Too many attempts, please try again in 5 minutes";

const TOO_FREQUENT = "Action too frequent, please try again later";

export const RATE_LIMITS = {
  loginByIp: { limit: 5, windowMs: 5 * MINUTE_MS, message: RETRY_IN_5_MINUTES },

  loginByAccount: { limit: 10, windowMs: 5 * MINUTE_MS, message: RETRY_IN_5_MINUTES },

  registerByIp: {
    limit: 5,
    windowMs: 5 * MINUTE_MS,
    message: "Registration too frequent, please try again in 5 minutes",
  },

  registerByAccount: {
    limit: 5,
    windowMs: 5 * MINUTE_MS,
    message: "Registration too frequent, please try again in 5 minutes",
  },

  passwordChangeByAccount: { limit: 10, windowMs: 5 * MINUTE_MS, message: RETRY_IN_5_MINUTES },

  tokenRefreshByIp: {
    limit: 30,
    windowMs: MINUTE_MS,
    message: "Refresh too frequent, please try again later",
  },

  postCreateByIp: {
    limit: 10,
    windowMs: 5 * MINUTE_MS,
    message: "Posting too frequent, please try again later",
  },

  postReactByIp: { limit: 30, windowMs: MINUTE_MS, message: TOO_FREQUENT },

  postViewByIp: { limit: 30, windowMs: 5 * MINUTE_MS },

  commentCreateByIp: {
    limit: 10,
    windowMs: 5 * MINUTE_MS,
    message: "Commenting too frequent, please try again later",
  },

  commentEditByIp: { limit: 30, windowMs: MINUTE_MS, message: TOO_FREQUENT },

  commentDeleteByIp: { limit: 30, windowMs: MINUTE_MS, message: TOO_FREQUENT },
} as const satisfies Record<string, RateLimitPolicy>;

export const DEFAULT_RATE_LIMIT_MESSAGE = TOO_FREQUENT;

export const PAGE_LIMITS = {
  postListDefaultLimit: 10,

  postListMaxLimit: 20_000,

  commentListDefaultLimit: 10,

  commentListMaxLimit: 50,

  postTagMaxCount: 20,
} as const;
