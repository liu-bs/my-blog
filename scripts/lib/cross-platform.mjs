import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return { loaded: false, path: envPath };
  const { config } = await import("dotenv");
  config({ path: envPath, override: false, quiet: true });
  return { loaded: true, path: envPath };
}

export async function requireDatabaseUrl(scriptName) {
  await loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      [
        "缺少 DATABASE_URL。",
        `  1) 在项目根创建 .env.local 并写入 DATABASE_URL=...`,
        `  2) 或直接注入环境变量后重跑：${scriptName}`,
        `  （dotenv 会自动加载 .env.local，不需要 --env-file）`,
      ].join("\n"),
    );
    process.exit(1);
  }
  return url;
}
