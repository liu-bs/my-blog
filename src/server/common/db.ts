import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@server/common/config/env";

const globalForPrisma = globalThis as unknown as {

  __prisma?: PrismaClient;
};

export const getPrisma = (): PrismaClient => {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });
  globalForPrisma.__prisma = prisma;
  return prisma;
};

export type PrismaTransaction = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
