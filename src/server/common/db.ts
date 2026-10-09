/**
 * @file db.ts
 * @description 服务端唯一的 Prisma 客户端获取入口，基于 PrismaNeon adapter 连接 Postgres，
 * 并提供交互式事务包装 runInTransaction。业务场景：所有 server/blog、server/comment、server/auth
 * 的 repository/service 层查询，以及限流、阅读计数等 API 路由的写操作。
 * 使用限制：文件顶部声明 server-only；客户端代码必须通过 API/Server Action 间接访问，不可直接 import。
 */
import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@server/common/config/env";

/**
 * globalThis 挂载点，用于跨模块重载缓存 Prisma 实例
 */
const globalForPrisma = globalThis as unknown as {
  /** 已创建的 Prisma 单例；开发环境热更新会反复重新执行本模块，靠它避免连接数爆炸 */
  __prisma?: PrismaClient;
};

/**
 * 获取共享的 Prisma 客户端（惰性单例）
 * @returns 已缓存或首次创建的 PrismaClient 实例
 * @throws 首次创建时 DATABASE_URL 非法或 Neon 连接初始化失败会抛出异常
 * @warning 返回的是全局共享实例，禁止调用 $disconnect()，否则后续所有请求都会失败
 * @example
 * const post = await getPrisma().post.findUnique({ where: { id } });
 */
export const getPrisma = (): PrismaClient => {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });
  // 先落到 globalThis 再返回，保证同一进程内后续调用复用同一连接池
  globalForPrisma.__prisma = prisma;
  return prisma;
};

/** 交互式事务内的数据库客户端类型，等价于 Prisma.TransactionClient */
type PrismaTransaction = Prisma.TransactionClient;

/**
 * 在一个数据库事务中执行回调，回调结束自动提交，抛错则整体回滚
 * @param fn 接收事务客户端的异步回调，回调内的读写必须使用 tx 而不是 getPrisma()
 * @returns 回调的返回值，类型由 T 推导
 * @throws 回调抛出的任何错误都会先回滚再原样冒泡；超过 Prisma 默认事务超时同样抛错
 * @example
 * await runInTransaction(async (tx) => {
 *   await tx.post.delete({ where: { id } });
 *   await tx.comment.deleteMany({ where: { postId: id } });
 * });
 * @warning 事务内不要发起 HTTP 请求或耗时计算，长事务会长时间占用连接并阻塞并发写
 */
export function runInTransaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
