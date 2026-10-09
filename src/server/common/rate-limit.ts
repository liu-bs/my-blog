/**
 * @file rate-limit.ts
 * @description 基于 Postgres "RateLimit" 表的固定窗口限流，以及从边缘代理请求头解析客户端 IP。
 * 业务场景：defineRoute 的 rateLimit 选项（按 key + IP 维度）、/api/auth/refresh 与文章浏览量上报
 * 等易被刷的接口。
 * 使用限制：限流状态落在数据库，多实例部署天然共享；单条 SQL 完成「插入/自增/到期重置」，
 * 依赖 (id) 唯一约束。查询失败时放行请求（fail-open），不阻断业务。
 */
import "server-only";
import { getPrisma } from "@server/common/db";
import { logger } from "@server/common/logger";

/**
 * 对指定 key 计数一次并判断是否已超限
 * @param key 限流维度标识，调用方需自行拼好（如 `${rateLimit.key}:${ip}`）
 * @param limit 窗口内允许的最大请求数，计数严格大于该值才算超限
 * @param windowMs 窗口长度，单位毫秒，由本次请求时刻起算
 * @returns true 表示本次请求应被拒绝；记录新建或计数未超限时为 false
 * @warning fail-open：数据库异常时记 error 日志并返回 false（放行），限流不可用不会导致接口不可用
 * @warning 窗口起点以「首次写入该 key」为准，持续以小于 windowMs 的间隔请求会不断刷新 expiresAt，
 * 理论上可形成不过期的滑动逃逸；如需严格窗口请改用带窗口序号的 key
 * @example
 * if (await isRateLimited(`view:${postId}:${ip}`, 30, 5 * 60 * 1000)) throw new RateLimitError();
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  // 表内主键加前缀命名空间，避免与其他直接写入 RateLimit 表的业务 key 相撞
  const id = `ratelimit:${key}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    // 单条 UPSERT 完成计数：冲突时若已过期则重置为 1 并重排到期时间，否则原子自增，
    // 靠 RETURNING 拿回判定用的最新计数，省去读写两次往返
    const rows = await getPrisma().$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" (id, count, "expiresAt")
      VALUES (${id}, 1, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET
        count = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
      RETURNING count
    `;
    const count = rows[0]?.count ?? 1;

    // 1% 抽样顺带清理过期行，把 GC 成本摊到正常请求上，避免额外定时任务；
    // fire-and-forget 且吞掉异常，清理失败不影响本次判定
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
 * 解析客户端真实 IP，作为限流 key 的维度
 * @param request 只需具备 headers.get 的请求对象（NextRequest 或兼容结构）
 * @returns 客户端 IP 字符串；所有头部都缺失时返回 "unknown"（此时同命名空间请求共享一个限流桶）
 * @warning 取值顺序为 x-nf-client-connection-ip → x-real-ip → x-forwarded-for；
 * x-forwarded-for 取的是**最右侧**一段（最接近自身的代理所写值），在多级可信代理链下与常见
 * 「取最左段」的实现相反，换 CDN 时需重新核对由谁覆写该头部
 * @example
 * const ip = getClientIp(request); // "203.0.113.9"
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
