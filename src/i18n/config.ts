/**
 * @file config.ts
 * @description i18n 层对外聚合出口：从 routing 派生 Locale 类型，并集中提供 <html lang>、og:locale 所需的语言代码映射。
 * 业务侧的类型与语言代码统一从这里导入，避免各处手写 "zh" | "en" 或区域代码
 */
import { routing } from "./routing";

/** 站点支持语言的联合类型，由 routing.locales 推导；新增语言时无需改动此处 */
export type Locale = (typeof routing.locales)[number];

/**
 * 映射为 <html lang> 所需的 BCP-47 语言标签
 * @param locale 站点内部语言标识
 * @returns zh 映射为 "zh-CN"，其余（en）映射为 "en"
 */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

/**
 * 映射为 Open Graph og:locale 所需的下划线区域代码
 * @param locale 站点内部语言标识
 * @returns zh 映射为 "zh_CN"，其余（en）映射为 "en_US"
 */
export function ogLocale(locale: Locale): string {
  return locale === "zh" ? "zh_CN" : "en_US";
}
