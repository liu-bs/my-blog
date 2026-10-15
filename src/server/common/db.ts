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

/** 单次查询的 fetch 超时；Neon 无响应时必须主动断开，否则会一直占住函数直到平台超时。 */
const DB_FETCH_TIMEOUT_MS = 8_000;

/**
 * 必须是**函数**，不能是 `AbortSignal.timeout(...)` 的求值结果。
 * driver 在每个请求里把 fetchOptions 展开进 fetch init（@neondatabase/serverless
 * index.js:1285），而 AbortSignal.timeout() 是一次性的：一旦到期就永久处于 aborted，
 * 而 getDb() 的 client 是跨请求复用的单例 —— 直接传信号值会让第一个请求之后的
 * 每次查询都在瞬间以 "The operation was aborted due to timeout" 失败。
 */
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

/** 动态拼装的多语句原子批：整批一个 fetch，要么全成要么全废 */
export function atomicBatch(statements: AtomicStatement[]): Promise<unknown[]> {
  return getDb().batch(statements as [AtomicStatement, ...AtomicStatement[]]);
}

/**
 * 可直接重试的 SQLSTATE 前缀：
 * 08 连接异常 / 40 序列化失败 / 53 资源不足 / 57P01 管理员关停 / 57014 statement_timeout。
 * 其余（23505 唯一键、23503 外键、42601 语法、42P01 表不存在等）重试必然同样失败。
 */
const RETRYABLE_SQLSTATE = /^(08|40|53|57P01|57014)/;

const DB_RETRY_DELAY_MS = 200;

function sqlStateOf(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Neon 把 Postgres 错误映射为 HTTP 400 并把 SQLSTATE 挂到 err.code；
 * 传输失败 / 5xx / 超时则没有 code。据此可以区分「注定失败」与「值得重试」。
 */
function isRetryable(error: unknown): boolean {
  if (isAppError(error)) return false;
  const code = sqlStateOf(error);
  if (code === undefined) return true;
  return RETRYABLE_SQLSTATE.test(code);
}

/**
 * 仅用于幂等读。写操作一律直接用 getDb()/atomicBatch，失败即抛给调用方，
 * 避免「响应丢失但写入已生效」被重试放大成重复写入。
 */
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
