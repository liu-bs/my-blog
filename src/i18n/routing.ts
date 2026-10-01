/**
 * @file routing.ts
 * @description next-intl 路由配置：声明站点支持的语言列表、默认语言与 URL 前缀策略，
 *              供中间件、request.ts 与 navigation.ts 共用，是 i18n 的唯一路由事实来源
 */
import { defineRouting } from "next-intl/routing";

/**
 * 全局 i18n 路由配置
 */
export const routing = defineRouting({
  /** 支持的语言列表，顺序即语言切换器展示顺序 */
  locales: ["zh", "en"],

  /** 默认语言，非法/缺失 locale 时回退到 zh */
  defaultLocale: "zh",

  /** URL 前缀策略：always 表示所有语言（含默认语言）路径都带 /zh、/en 前缀 */
  localePrefix: "always",
});
