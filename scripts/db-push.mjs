#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
  loadEnv({ path: path.join(root, ".env.local") });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL 未配置，无法建扩展或同步 schema");
  process.exit(1);
}

// schema.ts 里的 trgm GIN 索引依赖扩展先存在，drizzle-kit 不会自己建扩展
const sql = neon(databaseUrl);
await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "drizzle-kit", "bin.cjs"),
    "push",
    "--force",
    "--verbose",
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
