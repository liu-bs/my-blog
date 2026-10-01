import "server-only";
import { getPrisma } from "@server/common/db";
import { logger } from "@server/common/logger";

export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const id = `ratelimit:${key}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    const rows = await getPrisma().$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" (id, count, "expiresAt")
      VALUES (${id}, 1, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET
        count = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
      RETURNING count
    `;
    const count = rows[0]?.count ?? 1;

    if (Math.random() < 0.01) {
      void getPrisma()
        .rateLimit.deleteMany({ where: { expiresAt: { lt: now } } })
        .catch(() => {});
    }

    return count > limit;
  } catch (err) {
    logger.error("isRateLimited failed, request allowed", { key, error: String(err) });
    return false;
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
