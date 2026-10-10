import "server-only";
import { randomBytes } from "node:crypto";

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${key} must be a valid integer`);
  return parsed;
}

const NODE_ENV = getEnv("NODE_ENV", "development");

const JWT_SECRET = getEnv(
  "JWT_SECRET",
  NODE_ENV === "production" ? undefined : randomBytes(32).toString("hex"),
);

if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const DATABASE_URL = getEnv("DATABASE_URL");

const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());

  const seconds = match ? Number(match[1]) * (DURATION_UNITS[match[2] ?? "s"] ?? 1) : NaN;

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 7 * 24 * 60 * 60;
}

const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "7d");

export const env = {

  NODE_ENV,

  isProd: NODE_ENV === "production",

  JWT_SECRET,

  JWT_EXPIRES_IN,

  JWT_REFRESH_GRACE_SECONDS: getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),

  BCRYPT_SALT_ROUNDS: getInt("BCRYPT_SALT_ROUNDS", 10),

  COOKIE_MAX_AGE: getInt(
    "COOKIE_MAX_AGE",
    durationToSeconds(JWT_EXPIRES_IN) + getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),
  ),

  DATABASE_URL,
} as const;
