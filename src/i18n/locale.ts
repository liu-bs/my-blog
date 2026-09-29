/**
 * @file locale.ts
 * @description 服务端语言断言工具：把页面 / 布局收到的动态段字符串收窄成合法 Locale，非法值直接走 404
 */
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "./routing";
import type { Locale } from "./config";

/**
 * 断言 URL 动态段中的语言合法
 * @description 服务端读取当前语言的方式：App Router 会把 URL 里的 [locale] 作为 params 传给页面 / 布局，
 * 本函数用 routing.locales 白名单校验该原始字符串。
 * 回退顺序：这里不做回退，非法或缺失一律 notFound() 中断渲染；
 * request.ts 中另有一层 defaultLocale 兜底，那层保证语言包一定可加载，两层配合避免渲染出错乱内容
 * @param locale 动态段 [locale] 的原始字符串
 * @throws 语言不在 routing.locales 白名单时调用 notFound()，抛出 NEXT_NOT_FOUND
 */
export function assertLocale(locale: string): asserts locale is Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
}
