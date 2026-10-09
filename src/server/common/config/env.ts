/**
 * @file env.ts
 * @description 服务端环境变量统一读取与校验入口，导出不可变的 env 常量对象
 * （NODE_ENV、JWT 密钥与有效期、bcrypt 代价、Cookie 有效期、DATABASE_URL）。
 * 业务场景：auth 签发/刷新 token、blog/comment 仓储建库、logger 决定日志级别、部署健康检查。
 * 使用限制：文件顶部声明 server-only，仅可在服务端代码引用；模块在首次 import 时即完成校验，
 * 生产环境缺少 DATABASE_URL 或 JWT_SECRET 会直接抛错并使进程启动失败，属于「快速失败」设计。
 */
import "server-only";
import { randomBytes } from "node:crypto";

/**
 * 读取字符串型环境变量
 * @param key 环境变量名，如 JWT_SECRET
 * @param fallback 缺省值；传入 undefined 表示该变量必填
 * @returns 环境变量原始值（已排除空串）
 * @throws 变量未设置或为空字符串且未提供 fallback 时抛出 Missing required environment variable
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
 * 读取整型环境变量
 * @param key 环境变量名
 * @param fallback 解析失败或未设置时使用的默认值
 * @returns 十进制整数值
 * @throws 变量已设置但不是合法整数（如 "10x"）时抛出 must be a valid integer
 * @warning fallback 参数没有可选类型，意味着此函数永不因缺失变量而抛错，默认值必须显式给出
 */
function getInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${key} must be a valid integer`);
  return parsed;
}

/** 运行环境标识，取自 NODE_ENV，未设置时为 development */
const NODE_ENV = getEnv("NODE_ENV", "development");

/**
 * JWT HS256 签名密钥
 * 生产环境必须由 .env 提供且长度不少于 32 字符，缺失时启动即抛错；
 * 非生产环境允许缺省，退化为每次进程启动随机生成的 32 字节 hex，因此重启后旧 token 全部失效
 */
const JWT_SECRET = getEnv(
  "JWT_SECRET",
  NODE_ENV === "production" ? undefined : randomBytes(32).toString("hex"),
);

// 密钥过短会让 HS256 签名易被暴力破解，这里在模块加载阶段直接拒绝启动而不是静默警告
if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

/** Postgres 连接串（Neon 等），同时供 PrismaNeon adapter 与 prisma CLI 使用 */
const DATABASE_URL = getEnv("DATABASE_URL");

/** 时长后缀到秒数的换算表：s-秒 m-分 h-时 d-天 */
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/**
 * 把 "7d"、"3600"、"12h" 这类时长字符串解析为秒数
 * @param value 时长字符串，数字加可选单位后缀，允许首尾空格
 * @returns 正整数秒数；格式非法或结果不为正数时返回默认值 604800 秒（7 天）
 * @example
 * durationToSeconds("12h") // 43200
 * durationToSeconds("abc") // 604800
 * @warning 解析失败不抛错而是静默回落到 7 天，配置写错时 Cookie/token 会意外变得很长，需自行核对
 */
function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  // 无单位后缀时按秒处理；DURATION_UNITS 查不到也按 1 倍秒数兜底
  const seconds = match ? Number(match[1]) * (DURATION_UNITS[match[2] ?? "s"] ?? 1) : NaN;

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 7 * 24 * 60 * 60;
}

/** access token 有效期原始配置，JWT_EXPIRES_IN，默认 7d */
const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "7d");

/**
 * 服务端运行时配置集合，模块加载时一次性求值，之后不可变（as const）
 */
export const env = {
  /** 运行环境标识：development / test / production */
  NODE_ENV,

  /** 是否生产环境：logger 用它决定日志级别与 JSON 输出格式，auth 用它校验密钥强度 */
  isProd: NODE_ENV === "production",

  /** JWT 签名密钥，仅服务端持有，禁止透传到客户端或写入日志 */
  JWT_SECRET,

  /** access token 有效期字符串（如 7d），签发时交给 jose 解析 */
  JWT_EXPIRES_IN,

  /** token 过期后仍允许刷新的宽限时长，单位秒，JWT_REFRESH_GRACE_SECONDS，默认 3600（1 小时） */
  JWT_REFRESH_GRACE_SECONDS: getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),

  /** bcrypt 加代价（hash 轮数），BCRYPT_SALT_ROUNDS，默认 10；调高会显著增加登录/注册耗时 */
  BCRYPT_SALT_ROUNDS: getInt("BCRYPT_SALT_ROUNDS", 10),

  /**
   * 认证 Cookie 最大存活时长，单位秒
   * 默认值 = access token 有效秒数 + 刷新宽限秒数，保证 Cookie 不早于 token 失效
   */
  COOKIE_MAX_AGE: getInt(
    "COOKIE_MAX_AGE",
    durationToSeconds(JWT_EXPIRES_IN) + getInt("JWT_REFRESH_GRACE_SECONDS", 60 * 60),
  ),

  /** Postgres 连接串，db.ts 的 PrismaNeon adapter 唯一数据来源 */
  DATABASE_URL,
} as const;
