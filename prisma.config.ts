/**
 * @file prisma.config.ts
 * @description Prisma CLI 配置：指定 schema 位置与数据源连接串；非生产环境加载 .env.local，供 CLI 读取 DATABASE_URL
 */
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
