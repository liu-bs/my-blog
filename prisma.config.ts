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
