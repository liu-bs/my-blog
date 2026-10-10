import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@server/common/config/env";
import { isAppError } from "@server/common/errors";
import { logger } from "@server/common/logger";

export type DbClient = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export const getPrisma = (): PrismaClient => {
  if (globalForPrisma.prismaClient) return globalForPrisma.prismaClient;

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  globalForPrisma.prismaClient = prisma;
  return prisma;
};

export function runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}

const DB_RETRY_DELAY_MS = 1500;

export async function withDbRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isAppError(error)) throw error;
    logger.warn("Database read failed, retrying once", {
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
    return await load();
  }
}

function hasPrismaErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === code
  );
}

export function isUniqueConstraintViolation(err: unknown): boolean {
  return hasPrismaErrorCode(err, "P2002");
}

export function isRecordMissingError(err: unknown): boolean {
  return hasPrismaErrorCode(err, "P2025");
}

export function isForeignKeyViolation(err: unknown): boolean {
  return hasPrismaErrorCode(err, "P2003");
}
