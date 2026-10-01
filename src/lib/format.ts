/**
 * @file format.ts
 * @description Intl locale 感知的格式化纯函数：姓名首字母/拆分、千分位计数、日期与相对时间（zh/en）；日期解析失败时原样返回
 */
import type { Locale } from "@/i18n/config";

/** 站点 locale 到 Intl BCP-47 locale 的映射 */
const INTL_LOCALE: Record<Locale, string> = { zh: "zh-CN", en: "en-US" };

/** 相对时间格式化器，按 locale 缓存复用 */
const RELATIVE_FORMAT: Record<Locale, Intl.RelativeTimeFormat> = {
  zh: new Intl.RelativeTimeFormat(INTL_LOCALE.zh, { numeric: "auto" }),
  en: new Intl.RelativeTimeFormat(INTL_LOCALE.en, { numeric: "auto" }),
};

/**
 * 取姓名首字母作为头像字符，空名回退 "U"
 * @param firstName 名
 * @param lastName 姓
 * @returns 大写首字母
 */
export function getInitials(firstName: string, lastName: string): string {
  const name = (firstName || lastName || "").trim();
  return (name.charAt(0) || "U").toUpperCase();
}

/**
 * 按空格拆分全名为名/姓
 * @param fullName 完整姓名
 * @returns firstName 与 lastName
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

/**
 * 千分位格式化计数
 * @param n 数值
 * @returns 如 1,234
 */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * 按语言格式化日期（年月日）
 * @param dateStr 日期字符串
 * @param locale 站点语言，默认 zh
 * @returns 本地化日期，解析失败返回原字符串
 */
export function formatDate(dateStr: string, locale: Locale = "zh"): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * 按语言格式化相对时间（刚刚/N分钟前…），超过 30 天回退为绝对日期
 * @param dateStr 日期字符串
 * @param locale 站点语言，默认 zh
 * @returns 相对时间文案，解析失败返回原字符串
 */
export function formatRelativeTime(dateStr: string, locale: Locale = "zh"): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const rtf = RELATIVE_FORMAT[locale];
  const diff = Date.now() - d.getTime();

  // 按分钟/小时/天/周逐级降级展示
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  return formatDate(dateStr, locale);
}
