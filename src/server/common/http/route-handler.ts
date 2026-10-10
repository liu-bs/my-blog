import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { sendError } from "./api-response";
import { authenticate, tryAuthenticate } from "@server/auth/auth.guard";
import type { AuthPayload } from "@shared";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { DEFAULT_RATE_LIMIT_MESSAGE, type RateLimitPolicy } from "@server/common/policy";
import { RateLimitError } from "@server/common/errors";

interface RouteContext<P = Record<string, never>> {
  request: NextRequest;

  params: P;

  auth: AuthPayload | null;
}

interface RateLimitRule {
  key: string;

  policy: RateLimitPolicy;
}

interface RouteOptions {
  auth?: "required" | "optional" | "none";

  rateLimit?: RateLimitRule;
}

export function defineRoute<P = Record<string, never>>(
  handler: (ctx: RouteContext<P>) => Promise<NextResponse>,
  options?: RouteOptions,
) {
  return async (request: NextRequest, context?: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      let auth: AuthPayload | null = null;
      if (options?.auth === "required") {
        auth = await authenticate(request);
      } else if (options?.auth === "optional") {
        auth = await tryAuthenticate(request);
      }

      if (options?.rateLimit) {
        const ip = getClientIp(request);
        if (await isRateLimited(`${options.rateLimit.key}:${ip}`, options.rateLimit.policy)) {
          throw new RateLimitError(options.rateLimit.policy.message ?? DEFAULT_RATE_LIMIT_MESSAGE);
        }
      }

      const params = (context?.params ? await context.params : {}) as P;

      return await handler({ request, params, auth });
    } catch (err) {
      return sendError(err);
    }
  };
}
