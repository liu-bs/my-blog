import type { ValidationErrorDetail } from "./validation";

export interface ApiResponse<T> {
  code: number;

  data: T;

  message?: string;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "cache"> {
  body?: unknown;

  query?: Record<string, string | number | boolean | null | undefined>;

  skipAuthRedirect?: boolean;

  cache?: RequestCache;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,

    public readonly code: number,

    message: string,

    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}
