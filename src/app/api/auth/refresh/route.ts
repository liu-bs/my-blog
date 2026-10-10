import { NextResponse } from "next/server";
import { requireRefreshableSession } from "@server/auth/auth.guard";
import { setAuthCookiesOnResponse } from "@server/auth/auth.cookie";
import { toSafeUser } from "@server/auth/auth.service";
import { defineRoute } from "@server/common/http/route-handler";
import { RATE_LIMITS } from "@server/common/policy";

export const POST = defineRoute(
  async ({ request }) => {
    const { user } = await requireRefreshableSession(request);

    const response = NextResponse.json(
      { code: 0, data: { user: toSafeUser(user) }, message: "Token refreshed" },
      { status: 200 },
    );
    setAuthCookiesOnResponse(response, user);
    return response;
  },

  { rateLimit: { key: "auth:refresh", policy: RATE_LIMITS.tokenRefreshByIp } },
);
