/**
 * @file prisma.config.ts
 * @description Prisma CLI 配置（v7 新格式）：指定 schema 路径与数据源连接串。
 * 非生产环境下先加载根目录 .env.local，使 prisma 命令行（migrate/generate/studio）能读到 DATABASE_URL。
 */
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// 开发/测试环境补载本地环境变量；生产环境由部署平台直接注入
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

/**
 * Prisma CLI 配置项
 * @warning env("DATABASE_URL") 在缺失该变量时会使 CLI 直接报错，
 * 本地需确保 .env.local 已定义 DATABASE_URL。
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // 数据库连接串，延迟读取环境变量值
    url: env("DATABASE_URL"),
  },
});
