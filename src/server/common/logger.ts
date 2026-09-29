/**
 * @file logger.ts
 * @description 轻量结构化日志：统一输出「时间戳 + 级别 + 消息 + 自定义字段」，生产走 JSON 便于采集，开发走带颜色的可读格式。
 * 级别过滤按数字优先级实现，生产默认 info（过滤 debug），开发默认 debug。
 * 使用限制：依赖 env.isProd 决定输出格式，仅服务端使用；不引入外部日志库以保持冷启动体积。
 */
import { env } from "@server/common/config/env";

/** 日志级别，数值越大越严重 */
type LogLevel = "debug" | "info" | "warn" | "error";

/** 级别优先级表，用于「当前级别是否达到输出阈值」的比较 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  /** 调试细节，仅开发环境输出 */
  debug: 0,

  /** 常规信息 */
  info: 1,

  /** 可恢复的异常 / 客户端错误 */
  warn: 2,

  /** 需要人工介入的错误 */
  error: 3,
};

/** 生效的最低输出级别：生产只留 info 及以上，避免调试日志刷屏并减少日志量 */
const configuredLevel: LogLevel = env.isProd ? "info" : "debug";

/**
 * 判断某级别在当前环境下是否需要输出
 * @param level 待判断的日志级别
 * @returns 该级别不低于阈值时返回 true
 */
function isEnabled(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
}

/**
 * 生成 ISO 格式时间戳
 * @returns 当前时间的 ISO 字符串
 * @description 统一使用 ISO 8601，便于日志平台按时间排序与检索
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 日志实际输出函数
 * @param level 日志级别
 * @param message 主消息
 * @param meta 结构化附加字段，如 code / statusCode / stack
 * @description 生产环境统一写入 console.error 并序列化为 JSON，交给平台按 stdout 采集；
 * 开发环境拼接 ANSI 颜色输出到 console.log，meta 仅在有内容时追加
 */
function output(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!isEnabled(level)) return;

  const payload = {
    timestamp: formatTimestamp(),
    level: level.toUpperCase(),
    message,
    ...meta,
  };

  if (env.isProd) {
    // 用 error 流输出，保证在多数运行时里不被 stdout 缓冲吞掉
    console.error(JSON.stringify(payload));
    return;
  }

  const color = {
    debug: "\x1b[36m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  }[level];
  const reset = "\x1b[0m";
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${payload.timestamp}] ${color}${payload.level}${reset} ${message}${metaStr}`);
}

/**
 * 全局日志实例
 * @description 四个级别方法签名一致，业务按严重程度选择；低于当前阈值的调用会被直接丢弃
 */
export const logger = {
  /** 调试日志，生产环境不输出 */
  debug: (message: string, meta?: Record<string, unknown>) => output("debug", message, meta),

  /** 常规信息日志 */
  info: (message: string, meta?: Record<string, unknown>) => output("info", message, meta),

  /** 警告日志，用于 4xx 等可预期异常 */
  warn: (message: string, meta?: Record<string, unknown>) => output("warn", message, meta),

  /** 错误日志，用于 5xx 与未捕获异常 */
  error: (message: string, meta?: Record<string, unknown>) => output("error", message, meta),
};
