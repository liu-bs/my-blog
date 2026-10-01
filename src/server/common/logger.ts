/**
 * @file logger.ts
 * @description 服务端结构化日志工具。生产环境输出单行 JSON（便于日志采集），开发环境输出带颜色的可读格式；
 * 按 LOG 级别过滤，生产默认 info 起步，开发默认 debug。
 */
import { env } from "@server/common/config/env";

/** 日志级别 */
type LogLevel = "debug" | "info" | "warn" | "error";

/** 各日志级别优先级，数值越大越严重 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,

  info: 1,

  warn: 2,

  error: 3,
};

/** 当前生效的日志级别：生产 info、非生产 debug */
const configuredLevel: LogLevel = env.isProd ? "info" : "debug";

/**
 * 判断指定级别是否达到输出门槛
 * @param level 待判定的日志级别
 * @returns 是否应输出
 */
function isEnabled(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
}

/** 格式化当前时间为 ISO 8601 时间戳 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 按当前环境输出日志
 * 生产环境输出 JSON 单行（走 console.error 确保被平台采集）；开发环境输出彩色可读格式
 * @param level 日志级别
 * @param message 日志主体信息
 * @param meta 附加结构化字段
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
 * 全局日志实例，提供 debug/info/warn/error 四个级别方法
 */
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => output("debug", message, meta),

  info: (message: string, meta?: Record<string, unknown>) => output("info", message, meta),

  warn: (message: string, meta?: Record<string, unknown>) => output("warn", message, meta),

  error: (message: string, meta?: Record<string, unknown>) => output("error", message, meta),
};
