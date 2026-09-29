/**
 * @file format.ts
 * @description 展示层格式化工具集合：姓名、计数、日期的本地化输出，统一 Intl 用法并处理非法输入
 */
import type { Locale } from "@/i18n/config";

/** 应用语言到 BCP 47 语言标签的映射，供各类 Intl 构造器使用 */
const INTL_LOCALE: Record<Locale, string> = { zh: "zh-CN", en: "en-US" };

/** 相对时间格式化器按语言预建并复用；numeric: "auto" 让 1 天前输出「昨天」这类自然表达 */
const RELATIVE_FORMAT: Record<Locale, Intl.RelativeTimeFormat> = {
  zh: new Intl.RelativeTimeFormat(INTL_LOCALE.zh, { numeric: "auto" }),
  en: new Intl.RelativeTimeFormat(INTL_LOCALE.en, { numeric: "auto" }),
};

/**
 * 取姓名首字母作为头像占位文字
 * @description 中文名取首个汉字；姓与名都为空时用 "U" 兜底，保证头像不会渲染为空白
 * @param firstName 名（优先使用）
 * @param lastName 姓
 * @returns 单个大写字符
 */
export function getInitials(firstName: string, lastName: string): string {
  const name = (firstName || lastName || "").trim();
  return (name.charAt(0) || "U").toUpperCase();
}

/**
 * 按空格把全名拆成名与姓
 * @description 只以第一个空格为界：第一段为 firstName，其余全部（含空格）归入 lastName，
 * 以兼容「Van Dyke」这类多段姓氏
 * @param fullName 完整姓名
 * @returns firstName 名、lastName 姓；缺失部分为空串
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

/**
 * 格式化数量为千分位字符串
 * @description 固定用 en-US（而非当前语言），保证点赞数、浏览量等数字在不同语言下格式一致
 * @param n 数值
 * @returns 如 "1,234"
 */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * 格式化日期为「年月日」长格式
 * @param dateStr 日期字符串（ISO 等可被 Date 解析的格式）
 * @param locale 目标语言，默认中文
 * @returns 本地化日期文本；无法解析时原样返回入参，避免显示 Invalid Date
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
 * 格式化相对时间
 * @description 分级策略（单位换算后向下取整）：不足 1 分钟按「刚刚」；不足 60 分钟显示分钟；
 * 不足 24 小时显示小时；不足 7 天显示天；不足 30 天显示周；再久退化为绝对日期 {@link formatDate}。
 * 时间差按「当前时间 - 目标时间」计算，未来时间会得到 0 秒级表达，不做特殊处理
 * @param dateStr 日期字符串
 * @param locale 目标语言，默认中文
 * @returns 相对时间文案；无法解析时原样返回入参
 */
export function formatRelativeTime(dateStr: string, locale: Locale = "zh"): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const rtf = RELATIVE_FORMAT[locale];
  const diff = Date.now() - d.getTime();

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  // 传入负数表示「过去」，配合 numeric: "auto" 得到「x 分钟前」的表达
  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  return formatDate(dateStr, locale);
}
