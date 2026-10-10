import "server-only";

import { headers } from "next/headers";
import type { ActionResult, ValidationErrorDetail } from "@shared";
import { isAppError, NotFoundError, RateLimitError } from "@server/common/errors";
import { logger } from "@server/common/logger";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { DEFAULT_RATE_LIMIT_MESSAGE, type RateLimitPolicy } from "@server/common/policy";

export type { ActionResult };

const INTERNAL_ERROR = "Internal server error";

export function requireId(value: string | undefined, notFoundLabel: string): string {
  const id = value?.trim();
  if (!id) throw new NotFoundError(notFoundLabel);
  return id;
}

export async function clientIp(): Promise<string> {
  return getClientIp({ headers: await headers() });
}

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

export async function runAction<T>(label: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (err) {
    return toFailure(err, label);
  }
}

export async function ensureNotRateLimited(key: string, policy: RateLimitPolicy): Promise<void> {
  if (await isRateLimited(key, policy)) {
    throw new RateLimitError(policy.message ?? DEFAULT_RATE_LIMIT_MESSAGE);
  }
}
