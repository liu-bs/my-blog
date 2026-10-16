import "server-only";

import { neon } from "@neondatabase/serverless";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@server/db/schema";
import { env } from "@server/common/config/env";
import { isAppError } from "@server/common/errors";
import { logger } from "@server/common/logger";

export type Db = NeonHttpDatabase<typeof schema>;

export type AtomicStatement = BatchItem<"pg">;

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const DB_FETCH_TIMEOUT_MS = 8_000;

const freshFetchOptions = () => ({
  signal: AbortSignal.timeout(DB_FETCH_TIMEOUT_MS),
});

const globalForDb = globalThis as unknown as {
  drizzleDb?: Db;
};

export const getDb = (): Db => {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;

  const db = drizzle(
    neon(env.DATABASE_URL, {
      fetchOptions: freshFetchOptions,
    }),
    { schema },
  );

  globalForDb.drizzleDb = db;
  return db;
};

export function atomicBatch(statements: AtomicStatement[]): Promise<unknown[]> {
  return getDb().batch(statements as [AtomicStatement, ...AtomicStatement[]]);
}

const RETRYABLE_SQLSTATE = /^(08|40|53|57P01|57014)/;

const DB_RETRY_DELAY_MS = 200;

function sqlStateOf(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

function isRetryable(error: unknown): boolean {
  if (isAppError(error)) return false;
  const code = sqlStateOf(error);
  if (code === undefined) return true;
  return RETRYABLE_SQLSTATE.test(code);
}

export async function withReadRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    logger.warn("Database read failed, retrying once", {
      error: error instanceof Error ? error.message : String(error),
      code: sqlStateOf(error),
    });
    await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
    return await load();
  }
}

function hasSqlState(err: unknown, state: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === state
  );
}

export function isUniqueConstraintViolation(err: unknown): boolean {
  return hasSqlState(err, UNIQUE_VIOLATION);
}

export function isForeignKeyViolation(err: unknown): boolean {
  return hasSqlState(err, FOREIGN_KEY_VIOLATION);
}
