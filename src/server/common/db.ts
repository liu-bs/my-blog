/**
 * @file db.ts
 * @description Prisma 客户端工厂：通过 Neon serverless adapter 连接 Neon Postgres，并把实例挂到 globalThis 上复用。
 * 之所以不直接导出单例常量：Neon adapter 在连接串缺失等场景需要能延迟报错，且测试中可重置 global 上的实例。
 * 使用限制：仅服务端可用；不要在模块顶层直接调用 getPrisma()，应在请求内按需获取。
 */
import "server-only";

import { PrismaClient } from "@prisma/client";
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
