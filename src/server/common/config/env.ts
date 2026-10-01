/**
 * @file env.ts
 * @description 环境变量的集中读取、类型转换与合法性校验，导出唯一的 env 常量供服务端各模块使用。
 * 采用「启动即失败」策略：必填项缺失、格式错误或生产环境密钥过短都会直接抛错，避免把配置问题拖到运行期才暴露。
 * 使用限制：仅服务端可用；生产环境的 JWT_SECRET / DATABASE_URL 必须显式配置。
 */
import "server-only";
import { randomBytes } from "node:crypto";

/**
 * 读取字符串型环境变量
 * @param key 变量名
 * @param fallback 缺省值；未提供时该变量视为必填
 * @returns 变量值
 * @throws Error 变量未设置或为空串且没有 fallback
 * @description 把空串与未设置同等对待，防止 CI 里误传空值绕过校验
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
 * 读取整数型环境变量
 * @param key 变量名
 * @param fallback 缺省值（必填，整型配置都有合理默认）
 * @returns 解析后的整数
 * @throws Error 值无法解析为十进制整数
 */
function getInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${key} must be a valid integer`);
  return parsed;
}

const NODE_ENV = getEnv("NODE_ENV", "development");

/** JWT 签名密钥：生产环境必须显式配置；开发环境缺失时随机生成，代价是每次重启旧 token 全部失效 */
const JWT_SECRET = getEnv(
  "JWT_SECRET",
  NODE_ENV === "production" ? undefined : randomBytes(32).toString("hex"),
);

// 密钥长度不足会让签名可被暴力破解，生产环境直接拒绝启动
if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const DATABASE_URL = getEnv("DATABASE_URL");

/** JWT_EXPIRES_IN 在此之后，用于把 "7d" / "12h" / "30m" / 纯秒数这类时长串换算成秒 */
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/**
 * 解析 jsonwebtoken 风格的时长字符串为秒数
 * @param value 形如 "7d"、"12h"、"30m"、"3600"；无法识别时回退 7 天
 * @returns 对应秒数
 */
function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * (DURATION_UNITS[match[2] ?? "s"] ?? 1) : NaN;
  // 无法解析或单位为 jsonwebtoken 支持但此处未覆盖的 "w" 等，一律回退 7 天，避免把 COOKIE_MAX_AGE 算成过小的值
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 7 * 24 * 60 * 60;
}

const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "7d");

/**
 * 应用配置集合
 * @description 所有字段在模块加载时即完成读取与校验，业务代码直接读取常量而不再访问 process.env
 */
export const env = {
  /** 运行环境，未设置时默认 development */
  NODE_ENV,

  /** 是否生产环境，日志与错误脱敏逻辑据此切换 */
  isProd: NODE_ENV === "production",

  /** JWT 签名密钥 */
  JWT_SECRET,

  /** 访问令牌有效期，形如 "7d" / "12h"，直接交给 jsonwebtoken 解析 */
  JWT_EXPIRES_IN,

  /** 令牌过期后的宽限时间，单位秒；用于容忍并发刷新时旧 token 的短暂复用 */
  JWT_REFRESH_GRACE_SECONDS: getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),

  /** bcrypt 加盐轮数，越大越安全但登录越慢 */
  BCRYPT_SALT_ROUNDS: getInt("BCRYPT_SALT_ROUNDS", 10),

  /**
   * 登录 cookie 的最大存活时间，单位秒
   * @description 默认取「令牌有效期 + 刷新宽限期」：cookie 与令牌同时到期的话，
   * 浏览器会在令牌失效的同一刻删掉 cookie，宽限窗口内的无感续期根本带不出 token；
   * 让 cookie 多活一个宽限期，滑动续期链路才真正可达
   */
  COOKIE_MAX_AGE: getInt(
    "COOKIE_MAX_AGE",
    durationToSeconds(JWT_EXPIRES_IN) + getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),
  ),

  /** 数据库连接串，用于构造 Prisma Neon adapter */
  DATABASE_URL,
} as const;
