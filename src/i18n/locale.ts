/**
 * @file locale.ts
 * @description 动态路由段 [locale] 的运行时校验工具：把不可信的字符串参数收窄为 Locale 类型，
 *              非法值直接触发 404 兜底，页面组件在读取 params.locale 后应立即调用
 */
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "./routing";
import type { Locale } from "./config";

/**
 * 断言字符串是受支持的 locale
 * @param locale 动态路由段传入的原始字符串参数
 * @throws 非法 locale 时调用 notFound() 渲染 404 页面（不再返回）
 * @asserts 校验通过后 locale 被类型收窄为 Locale，后续代码无需再判空
 */
export function assertLocale(locale: string): asserts locale is Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
}
