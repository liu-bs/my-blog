/**
 * @file config.ts
 * @description locale 相关类型与外部标准映射：导出 Locale 类型，并把内部短码（zh/en）
 *              转换为 HTML lang 属性与 Open Graph locale 规范要求的格式，供 SEO 元数据使用
 */
import { routing } from "./routing";

/** 受支持的语言类型，由 routing.locales 推导，与路由配置保持单一来源 */
export type Locale = (typeof routing.locales)[number];

/**
 * 转换为 HTML lang 属性值（BCP 47 格式）
 * @param locale 站点内部语言码
 * @returns 如 zh → "zh-CN"、en → "en"
 */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

/**
 * 转换为 Open Graph 的 og:locale 值（下划线分隔格式）
 * @param locale 站点内部语言码
 * @returns 如 zh → "zh_CN"、en → "en_US"
 */
export function ogLocale(locale: Locale): string {
  return locale === "zh" ? "zh_CN" : "en_US";
}
