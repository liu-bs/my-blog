/**
 * @file rate-limit.ts
 * @description 服务端限流工具。基于 PostgreSQL RateLimit 表的单条原子 upsert 实现固定窗口计数，
 * 多实例部署下共享同一数据库即可保证限流全局生效；数据库异常时 fail-open（放行请求）并记录日志。
 */
import "server-only";
import { getPrisma } from "@server/common/db";
import { logger } from "@server/common/logger";

/**
 * 判断指定 key 在当前时间窗口内的请求是否已超过限流阈值
 * @param key 限流标识（如 "ip:1.2.3.4:login"），内部会加 ratelimit: 前缀
 * @param limit 窗口内允许的最大次数，超过即返回 true
 * @param windowMs 固定窗口时长，单位毫秒，窗口过期后计数自动归零重新开始
 * @returns 是否已被限流（true 表示应拒绝请求）
 * @warning 数据库异常时 fail-open 返回 false 放行请求，仅保证限流尽力而为
 */
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

    // 1% 概率异步清理已过期的限流记录，避免表无限膨胀；失败静默忽略
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

/**
 * 从请求头中提取客户端真实 IP
 * 优先级：Netlify 专用头 > x-real-ip > x-forwarded-for 最后一跳
 * @param request 仅依赖 headers.get 的最小请求结构
 * @returns 客户端 IP，均无法获取时返回 "unknown"
 */
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
