/**
 * @file message.ts
 * @description 非组件环境（Hook、工具函数、请求封装）中的 i18n 文案取值：从 feedback 文案表中按「分组 + key」取串、
 * 做占位符插值，并把错误对象归类为可展示文案。组件内仍用 next-intl，此处是它的轻量补充
 */
import type { ValidationRule } from "@shared";
import zhFeedback from "@/i18n/messages/zh/feedback";
import enFeedback from "@/i18n/messages/en/feedback";

/** 文案语言；与路由前缀一一对应 */
export type MsgLocale = "zh" | "en";

/** 占位符参数表，值会被转成字符串替换到 `{name}` 处 */
export type MsgParams = Record<string, string | number>;

/** 文案占位符语法：`{name}` */
const PLACEHOLDER = /\{(\w+)\}/g;

/** 以中文文案表的结构作为全站文案的类型基准（英文表需与其保持同构） */
type FeedbackShape = typeof zhFeedback;

/** 中英文文案表 */
const FEEDBACK: { readonly zh: FeedbackShape; readonly en: FeedbackShape } = {
  zh: zhFeedback,
  en: enFeedback,
};

/** 顶层文案分组名，如 common / form / entity 等 */
export type MsgGroup = keyof FeedbackShape;

/** 某分组下的 key，如 common.timeout */
export type MsgKey<G extends MsgGroup> = keyof FeedbackShape[G];

/** 把某分组的所有 key 约束为返回 string，便于索引取串 */
type GroupStrings<G extends MsgGroup> = { [K in keyof FeedbackShape[G]]: string };

/**
 * 获取当前语言
 * @description 以 URL 路径前缀判断：/en 开头即英文，其余（含 SSR 外的未知环境）默认中文。
 * 之所以从 pathname 推断而不用 next-intl 的 context，是因为请求封装、错误映射等场景拿不到组件上下文
 * @returns 当前文案语言
 */
export function currentMsgLocale(): MsgLocale {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/en")) return "en";
  return "zh";
}

/**
 * 把模板中的 `{name}` 占位符替换为参数值
 * @param template 文案模板
 * @param params 参数表
 * @returns 插值后的文案；缺少参数时保留原占位符，并在非生产环境打印告警以便及早发现漏传
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
 * 取一段文案并插值
 * @param group 文案分组
 * @param key 分组下的 key
 * @param params 插值参数
 * @param locale 目标语言，默认按当前 URL 推断 {@link currentMsgLocale}
 * @returns 最终文案
 * @example msg("common", "requestFailed", { status: 500 })
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

/** 业务实体名（文章、评论等）的 key */
export type EntityKey = keyof FeedbackShape["entity"];

/**
 * 取实体名的本地化文案
 * @param name 实体 key
 * @param locale 目标语言，默认当前语言
 * @returns 实体名文案
 */
export function entityName(name: EntityKey, locale: MsgLocale = currentMsgLocale()): string {
  return FEEDBACK[locale].entity[name];
}

/**
 * 取字段名的本地化文案
 * @param name 字段名（对应校验详情中的 path）
 * @param locale 目标语言
 * @returns 字段名文案；未登记时返回 undefined，调用方据此退化为通用文案
 */
function fieldName(name: string, locale: MsgLocale = currentMsgLocale()): string | undefined {
  const dict: Record<string, string> = FEEDBACK[locale].field;
  return dict[name];
}

/** HTTP 状态码到通用文案的映射；0 表示网络层失败（无响应） */
const STATUS_MESSAGES: Record<number, { group: MsgGroup; key: string }> = {
  0: { group: "common", key: "networkError" },
  401: { group: "common", key: "sessionExpired" },
  403: { group: "common", key: "forbidden" },
  404: { group: "common", key: "contentGone" },
  408: { group: "common", key: "timeout" },
  429: { group: "common", key: "rateLimited" },
  500: { group: "common", key: "unknownError" },
};

/**
 * 从错误对象上读取数字状态码
 * @param err 任意错误
 * @returns 状态码；非数字时返回 null
 */
function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

/**
 * 把错误对象转成可展示文案
 * @description 判定顺序：无状态码 → 兜底文案或「未知错误」；命中 {@link STATUS_MESSAGES} → 对应通用文案；
 * 其余 4xx → 「操作失败」；5xx → 「未知错误」。有意不透出服务端原始文案，避免技术细节直接暴露给用户
 * @param err 错误对象
 * @param locale 目标语言
 * @param fallback 无状态码时的兜底文案
 * @returns 可展示的错误文案
 */
export function errorToMsg(
  err: unknown,
  locale: MsgLocale = currentMsgLocale(),
  fallback?: string,
): string {
  const status = statusOf(err);
  if (status === null) return fallback ?? msg("common", "unknownError", undefined, locale);
  const mapped = STATUS_MESSAGES[status];

  if (mapped) return msg(mapped.group, mapped.key as never, undefined, locale);

  if (status < 500) return msg("common", "actionFailed", undefined, locale);
  return msg("common", "unknownError", undefined, locale);
}

/**
 * 把服务端字段校验详情转成可展示文案
 * @description 判定顺序：先看显式 rule（imageUrl / nonBlank / passwordMismatch，语义强于 zod code），
 * 再看 zod code（too_small 时 min ≤ 1 视为「必填」，否则「过短」；too_big 视为「过长」；其余视为格式错误）；
 * 字段名未登记时统一退化为「字段无效」，避免出现英文 key
 * @param detail 校验详情，含字段路径、rule、zod code 与 min/max 参数
 * @param locale 目标语言
 * @returns 可展示的字段错误文案
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

  switch (detail.code) {
    case "too_small": {
      if (!label) return invalid;
      // min 为 1 时本质是「必填」，用更贴切的文案
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
