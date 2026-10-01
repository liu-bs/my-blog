/**
 * @file message.ts
 * @description 客户端多语言文案与错误文案映射：从 URL 前缀推断当前语言，读取 zh/en feedback 词条并做占位符替换；错误按状态码映射文案，校验明细按规则转为可读文案
 */
import type { ValidationRule } from "@shared";
import zhFeedback from "@/i18n/messages/zh/feedback";
import enFeedback from "@/i18n/messages/en/feedback";

/** 支持的消息语言 */
export type MsgLocale = "zh" | "en";

/** 文案占位符参数 */
export type MsgParams = Record<string, string | number>;

/** 文案模板占位符，如 {entity} */
const PLACEHOLDER = /\{(\w+)\}/g;

/** zh 反馈词条结构，作为类型与词库基准 */
type FeedbackShape = typeof zhFeedback;

/** zh/en 反馈词库 */
const FEEDBACK: { readonly zh: FeedbackShape; readonly en: FeedbackShape } = {
  zh: zhFeedback,
  en: enFeedback,
};

export type MsgGroup = keyof FeedbackShape;

export type MsgKey<G extends MsgGroup> = keyof FeedbackShape[G];

type GroupStrings<G extends MsgGroup> = { [K in keyof FeedbackShape[G]]: string };

/**
 * 获取当前消息语言
 * @returns 根据 URL 路径前缀判断，/en 开头为 en，否则为 zh
 */
export function currentMsgLocale(): MsgLocale {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/en")) return "en";
  return "zh";
}

/**
 * 替换文案模板中的 {name} 占位符，缺参时保留占位并在开发环境告警
 * @param template 文案模板
 * @param params 占位符参数
 * @returns 渲染后的文案
 */
function formatMsg(template: string, params?: MsgParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (raw, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[message] 缺少占位符参数 ${raw}`);
      }
      return raw;
    }
    return String(value);
  });
}

/**
 * 读取指定分组与键的多语言文案
 * @param group 词条分组
 * @param key 词条键
 * @param params 占位符参数
 * @param locale 指定语言，默认取当前语言
 * @returns 渲染后的文案
 */
export function msg<G extends MsgGroup>(
  group: G,
  key: MsgKey<G>,
  params?: MsgParams,
  locale: MsgLocale = currentMsgLocale(),
): string {
  const groupDict = FEEDBACK[locale][group] as GroupStrings<G>;
  return formatMsg(groupDict[key], params);
}

/**
 * 实体名词条键（用于拼接"文章/评论"等名词）
 */
export type EntityKey = keyof FeedbackShape["entity"];

/**
 * 获取实体显示名（如"文章"、"评论"）
 * @param name 实体键
 * @param locale 指定语言，默认取当前语言
 * @returns 实体名文案
 */
export function entityName(name: EntityKey, locale: MsgLocale = currentMsgLocale()): string {
  return FEEDBACK[locale].entity[name];
}

/** 获取字段显示名，未配置时返回 undefined */
function fieldName(name: string, locale: MsgLocale = currentMsgLocale()): string | undefined {
  const dict: Record<string, string> = FEEDBACK[locale].field;
  return dict[name];
}

/**
 * HTTP 状态码到文案词条的映射表
 */
const STATUS_MESSAGES: Record<number, { group: MsgGroup; key: string }> = {
  0: { group: "common", key: "networkError" },
  401: { group: "common", key: "sessionExpired" },
  403: { group: "common", key: "forbidden" },
  404: { group: "common", key: "contentGone" },
  408: { group: "common", key: "timeout" },
  429: { group: "common", key: "rateLimited" },
  500: { group: "common", key: "unknownError" },
};

/** 读取错误的 status 字段，非数字返回 null */
function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

/**
 * 把任意错误转为用户可读文案
 * @param err 错误对象，读取 status 做映射
 * @param locale 指定语言，默认取当前语言
 * @param fallback 无 status 时的兜底文案
 * @returns 错误文案
 */
export function errorToMsg(
  err: unknown,
  locale: MsgLocale = currentMsgLocale(),
  fallback?: string,
): string {
  const status = statusOf(err);
  if (status === null) return fallback ?? msg("common", "unknownError", undefined, locale);
  const mapped = STATUS_MESSAGES[status];

  // 命中映射表的按词条输出
  if (mapped) return msg(mapped.group, mapped.key as never, undefined, locale);

  // 未命中：4xx 视为操作失败，其余视为未知错误
  if (status < 500) return msg("common", "actionFailed", undefined, locale);
  return msg("common", "unknownError", undefined, locale);
}

/**
 * 把字段校验明细转为可读文案（必填/长度/格式等规则）
 * @param detail 校验明细
 * @param locale 指定语言，默认取当前语言
 * @returns 错误文案
 */
export function detailToMsg(
  detail: {
    path: string;
    code?: string;
    rule?: ValidationRule;
    params?: { min?: number; max?: number };
  },
  locale: MsgLocale = currentMsgLocale(),
): string {
  const label = fieldName(detail.path, locale);
  const invalid = msg("form", "invalidField", undefined, locale);

  // 特殊业务规则优先
  if (detail.rule) {
    switch (detail.rule) {
      case "imageUrl":
        return msg("form", "imageUrl", undefined, locale);
      case "nonBlank":
        return label ? msg("form", "requiredInput", { field: label }, locale) : invalid;
      case "passwordMismatch":
        return msg("form", "sameAsCurrent", undefined, locale);
    }
  }

  // zod 校验码映射：过短/过长/其他格式错误
  switch (detail.code) {
    case "too_small": {
      if (!label) return invalid;

      const min = detail.params?.min ?? 1;
      return min <= 1
        ? msg("form", "requiredInput", { field: label }, locale)
        : msg("form", "tooShort", { field: label, min }, locale);
    }
    case "too_big": {
      const max = detail.params?.max;
      if (!label || max === undefined) return invalid;
      return msg("form", "tooLong", { field: label, max }, locale);
    }
    default:
      return label ? msg("form", "format", { field: label }, locale) : invalid;
  }
}
