/**
 * @file env.ts
 * @description 服务端环境变量集中解析模块。启动时即校验必填项（缺失直接抛错阻止启动），
 * 生产环境强制 JWT_SECRET ≥32 字符、非生产缺失时自动生成随机密钥便于本地开发；
 * 解析结果以只读 env 对象导出，全站统一从此读取配置。
 */
import "server-only";
import { randomBytes } from "node:crypto";

/**
 * 读取字符串环境变量
 * @param key 环境变量名
 * @param fallback 可选默认值；未提供且变量缺失/为空时抛错
 * @returns 环境变量值
 * @throws 必填变量缺失或为空字符串时抛出 Error
 */
function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * 读取整数环境变量
 * @param key 环境变量名
 * @param fallback 缺失/为空时的默认值
 * @returns 解析后的整数
 * @throws 值不是合法整数时抛出 Error
 */
function getInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${key} must be a valid integer`);
  return parsed;
}

/** 运行环境标识，默认 development */
const NODE_ENV = getEnv("NODE_ENV", "development");

// JWT 签名密钥：生产必须显式配置（缺失即启动报错），非生产缺失时随机生成以方便本地开发
const JWT_SECRET = getEnv(
  "JWT_SECRET",
  NODE_ENV === "production" ? undefined : randomBytes(32).toString("hex"),
);

// 生产环境强制密钥强度，防止弱密钥被暴力破解
if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const DATABASE_URL = getEnv("DATABASE_URL");

/** 时间单位到秒的换算表，用于解析 "7d" 形式的时长字符串 */
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/**
 * 将 "7d"/"12h"/"30m"/"10s" 形式的时长字符串换算为秒
 * @param value 时长字符串
 * @returns 秒数；格式非法时兜底返回 7 天
 */
function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * (DURATION_UNITS[match[2] ?? "s"] ?? 1) : NaN;

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 7 * 24 * 60 * 60;
}

const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "7d");

/**
 * 服务端环境配置（启动时一次性解析，只读）
 */
export const env = {
  /** 运行环境标识 */
  NODE_ENV,

  /** 是否生产环境 */
  isProd: NODE_ENV === "production",

  /** JWT 签名密钥 */
  JWT_SECRET,

  /** JWT 有效期原始字符串，如 "7d" */
  JWT_EXPIRES_IN,

  /** 过期令牌的静默刷新宽限期（秒），默认 1 小时；同时计入认证 Cookie 存活期 */
  JWT_REFRESH_GRACE_SECONDS: getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),

  /** bcrypt 加密轮数，默认 10 */
  BCRYPT_SALT_ROUNDS: getInt("BCRYPT_SALT_ROUNDS", 10),

  /** 认证 Cookie 最大存活（秒），默认为 JWT 有效期 + 刷新宽限期 */
  COOKIE_MAX_AGE: getInt(
    "COOKIE_MAX_AGE",
    durationToSeconds(JWT_EXPIRES_IN) + getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),
  ),

  /** 数据库连接串 */
  DATABASE_URL,
} as const;
