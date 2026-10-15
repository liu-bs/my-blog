import { config } from "dotenv";
import type { Config } from "drizzle-kit";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

export default {
  schema: "src/server/db/schema.ts",
  out: "drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
} satisfies Config;
