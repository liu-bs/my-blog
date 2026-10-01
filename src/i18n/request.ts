/**
 * @file request.ts
 * @description next-intl 服务端请求配置：解析当前请求的 locale 并动态加载对应语言包，
 *              校验失败时回退默认语言，保证每个服务端请求都能拿到合法的 locale 与 messages
 */
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

/**
 * 每次服务端渲染请求时由 next-intl 调用，返回该请求使用的 locale 与语言包
 */
export default getRequestConfig(async ({ requestLocale }) => {
  /** 优先取根布局段参数中的 locale（SSG 场景），取不到再回退请求上下文里的 locale */
  const requested = (await rootLocale().catch(() => undefined)) ?? (await requestLocale);

  /** 请求的 locale 不在支持列表内时，回退到默认语言 */
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  /** 动态加载对应语言的文案集合，仅打包当前语言，避免全量语言包进入产物 */
  const messages = (await import(`./messages/${locale}`)).default;
  return { locale, messages };
});
