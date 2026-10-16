import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@server/common/db";
import { rateLimits } from "@server/db/schema";
import { logger } from "@server/common/logger";
import type { RateLimitPolicy } from "@server/common/policy";

export async function isRateLimited(
  key: string,
  policy: RateLimitPolicy,
  mode: "fail-open" | "fail-closed" = "fail-closed",
): Promise<boolean> {
  const id = `ratelimit:${key}`;

  const upsert = getDb()
    .insert(rateLimits)
    .values({
      id,
      count: 1,
      expiresAt: sql`now() + ${policy.windowMs} * interval '1 millisecond'`,
    })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: {
        count: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= now()
          THEN now() + ${policy.windowMs} * interval '1 millisecond'
          ELSE ${rateLimits.expiresAt} END`,
      },
    })
    .returning({ count: rateLimits.count });

  try {
    const results = await getDb().batch([
      upsert,
      ...(Math.random() < 0.01
        ? [
            getDb()
              .delete(rateLimits)
              .where(sql`${rateLimits.expiresAt} <= now()`),
          ]
        : []),
    ]);

    const rows = results[0] as { count: number }[];
    const count = rows[0]?.count ?? 1;

    return count > policy.limit;
  } catch (err) {
    logger.error("isRateLimited failed", { key, mode, error: String(err) });
    return mode === "fail-closed";
  }
}

export function getClientIp(request: { headers: Pick<Headers, "get"> }): string {
  const nfIp = request.headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp;

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const segments = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last;
  }

  return "unknown";
}
