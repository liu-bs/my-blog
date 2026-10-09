/**
 * @file logger.ts
 * @description 服务端统一结构化日志出口，按 env.isProd 自动切换输出形态：生产环境走
 * console.error 输出单行 JSON（便于日志采集器解析），开发环境走 console.log 输出带 ANSI
 * 颜色的人类可读行。业务场景：defineRoute 记录请求失败、限流降级、auth/blog/comment 各层的
 * 关键路径埋点。
 * 使用限制：级别门槛在模块首次加载时由 env.isProd 定死（生产 info 及以上、开发全量），
 * 运行时不可调整；debug 级日志在生产环境会被静默丢弃。
 */
import { env } from "@server/common/config/env";

/** 日志级别，按严重程度递增 */
type LogLevel = "debug" | "info" | "warn" | "error";

/** 级别优先级表，数值越大越严重，用于 isEnabled 的门槛比较 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  /** 调试信息，仅开发环境输出 */
  debug: 0,

  /** 常规运行信息 */
  info: 1,

  /** 可恢复异常、降级路径 */
  warn: 2,

  /** 需要人工关注的失败 */
  error: 3,
};

/** 当前进程的最低输出级别：生产 info（丢弃 debug），开发 debug（全量） */
const configuredLevel: LogLevel = env.isProd ? "info" : "debug";

/**
 * 判断某级别是否达到输出门槛
 * @param level 待判定的日志级别
 * @returns true 表示应输出，false 表示被级别门槛过滤
 */
function isEnabled(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
}

/**
 * 生成 ISO 8601 UTC 时间戳
 * @returns 形如 2026-10-09T12:00:00.000Z 的时间字符串
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 按当前环境格式化并输出一条日志
 * @param level 日志级别，决定颜色、输出流与是否被过滤
 * @param message 日志正文
 * @param meta 附加结构化字段，会被展开进 JSON 或追加为尾部 JSON 片段；注意字段名与
 * timestamp/level/message 同名时会覆盖前者
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
    // 生产统一走 stderr + 单行 JSON，避免混入 stdout 的业务输出且方便采集端按行解析
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
 * 日志门面，四个方法分别对应四个级别
 * @example
 * logger.warn("rate limit hit", { key, count });
 * @warning meta 中的 Error 对象不会被自动序列化，需自行转 String(err) 或取 err.stack
 */
export const logger = {
  /** 输出 debug 级日志（生产环境被过滤） */
  debug: (message: string, meta?: Record<string, unknown>) => output("debug", message, meta),

  /** 输出 info 级日志 */
  info: (message: string, meta?: Record<string, unknown>) => output("info", message, meta),

  /** 输出 warn 级日志 */
  warn: (message: string, meta?: Record<string, unknown>) => output("warn", message, meta),

  /** 输出 error 级日志，生产环境写入 stderr */
  error: (message: string, meta?: Record<string, unknown>) => output("error", message, meta),
};
