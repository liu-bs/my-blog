/**
 * @file rate-limit.ts
 * @description 基于数据库的请求限流，按「业务 key + 客户端 IP」在滑动窗口内计数；用于登录、注册等写接口防刷
 */
import "server-only";
import { getPrisma } from "@server/common/db";
import { logger } from "@server/common/logger";

/**
 * 判断指定 key 在窗口内的请求次数是否已超限
 * @description 计数保存在 RateLimit 表，用一条 upsert SQL 同时完成「窗口过期则重置为 1」与「未过期则累加」，避免先读后写带来的并发竞态
 * @param key 限流标识，调用方需自行拼接客户端 IP 以区分来源
 * @param limit 窗口内允许的最大请求次数
 * @param windowMs 时间窗口长度，单位毫秒
 * @returns 已超限返回 true，未超限返回 false
 * @warning 限流依赖数据库可用性；查询异常时选择放行，避免数据库抖动把正常流量整体拦死
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

    // 以约 1% 的概率顺带清理过期记录，省掉一个定时清理任务
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
 * 获取客户端真实 IP
 * @description 按部署环境逐个降级读取代理头：Netlify 注入的头部优先，其次反向代理写入的 x-real-ip，最后取 x-forwarded-for 最右侧一段
 * @param request 仅依赖 headers 的最小请求结构，便于单测与复用
 * @returns 客户端 IP，全部头部缺失时返回 "unknown"
 * @warning x-forwarded-for 取最右侧一段而非首段，因为首段可被客户端伪造，最右侧才是本站信任的代理写入的值
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
