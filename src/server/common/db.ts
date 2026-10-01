/**
 * @file db.ts
 * @description Prisma 客户端工厂：通过 Neon serverless adapter 连接 Neon Postgres，并把实例挂到 globalThis 上复用。
 * 之所以不直接导出单例常量：Neon adapter 在连接串缺失等场景需要能延迟报错，且测试中可重置 global 上的实例。
 * 使用限制：仅服务端可用；不要在模块顶层直接调用 getPrisma()，应在请求内按需获取。
 */
import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@server/common/config/env";

/** 挂在 global 上的 Prisma 实例，避免 Next.js dev 热更新时反复创建连接池 */
const globalForPrisma = globalThis as unknown as {
  /** 缓存的 Prisma 客户端实例 */
  __prisma?: PrismaClient;
};

/**
 * 获取 Prisma 客户端
 * @returns 进程内共享的 PrismaClient
 * @description 首次调用时用 Neon serverless adapter 建立连接并缓存到 globalThis；后续调用直接复用，
 * 既可避免 dev 热更新导致的连接数暴涨，也让 serverless 环境下的连接在实例存活期内被复用
 */
export const getPrisma = (): PrismaClient => {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });
  globalForPrisma.__prisma = prisma;
  return prisma;
};

/** Prisma 交互式事务回调注入的事务客户端类型；供数据/业务层把一批写操作放进同一事务边界 */
export type PrismaTransaction = Prisma.TransactionClient;

/**
 * 在一个交互式事务中执行一批操作
 * @description 封装 Prisma 官方交互式事务 API（`prisma.$transaction(async (tx) => {...})`）：
 * 业务层只需传入以事务客户端为参数的回调，无需再直接持有 PrismaClient，从而把「连接获取 /
 * 事务边界」这一持久化关注点收敛到本数据访问模块，Service 层不再出现裸 Prisma。
 * 回调内任一操作抛错即整体回滚，正常返回则提交，并把回调返回值原样透出——与直接调用
 * `$transaction` 行为完全等价。
 * @param fn 接收事务客户端、返回任意结果的回调
 * @returns 回调的执行结果
 */
export function runInTransaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
