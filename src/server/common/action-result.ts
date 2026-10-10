import "server-only";

import { headers } from "next/headers";
import type { ValidationErrorDetail, AuthPayload } from "@shared";
import { isAppError, RateLimitError, UnauthorizedError } from "@server/common/errors";
import { logger } from "@server/common/logger";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { getAuthPayload } from "@server/auth/auth.service";

export async function clientIp(): Promise<string> {
  return getClientIp({ headers: await headers() });
}

import type { ActionResult } from "@shared";

export type { ActionResult };

const INTERNAL_ERROR = "Internal server error";

export function toFailure(
  err: unknown,
  label = "Server Action",
): Extract<ActionResult<never>, { ok: false }> {
  if (!isAppError(err)) {
    logger.error(err instanceof Error ? err.message : `${label} unknown error`, {
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, status: 500, message: INTERNAL_ERROR };
  }
  if (err.statusCode >= 500) {
    logger.error(err.message, { code: err.code, statusCode: err.statusCode });
    return { ok: false, status: err.statusCode, message: INTERNAL_ERROR };
  }
  return {
    ok: false,
    status: err.statusCode,
    message: err.message,
    details: err.details as ValidationErrorDetail[] | undefined,
  };
}

export async function runAction<T>(
  label: string,
  run: (ctx: { authPayload: () => Promise<AuthPayload | null> }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run({ authPayload: getAuthPayload });
  } catch (err) {
    return toFailure(err, label);
  }
}

export async function requireAuthPayload(
  authPayload: () => Promise<AuthPayload | null>,
): Promise<AuthPayload> {
  const payload = await authPayload();
  if (!payload) throw new UnauthorizedError();
  return payload;
}

export async function ensureNotRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): Promise<void> {
  if (await isRateLimited(key, limit, windowMs)) {
    throw new RateLimitError(message);
  }
}
