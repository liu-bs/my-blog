/**
 * @file db.ts
 * @description Prisma 客户端单例工厂。基于 Neon serverless 适配器（PrismaNeon）连接数据库，
 * 实例挂在 globalThis 上避免开发环境热重载重复创建连接；并提供事务执行辅助。
 */
import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@server/common/config/env";

/** 跨热重载持有 Prisma 单例的全局容器 */
const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

/**
 * 获取 Prisma 客户端单例
 * 首次调用时以 Neon 适配器创建并缓存到 globalThis，后续调用直接复用
 * @returns PrismaClient 实例
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

/** Prisma 事务客户端类型别名 */
export type PrismaTransaction = Prisma.TransactionClient;

/**
 * 在数据库事务中执行回调，回调抛错则整体回滚
 * @param fn 事务回调，入参为事务客户端
 * @returns 回调的返回值
 */
export function runInTransaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
