/**
 * @file routing.ts
 * @description next-intl 路由配置的唯一真源：声明支持的语言、默认语言与 URL 语言前缀策略。
 * 该配置被 navigation / request / config / locale 共同引用，改动会直接影响全站 URL 形态、语言切换与 SEO 收录
 */
import { defineRouting } from "next-intl/routing";

/**
 * 全站路由配置
 */
export const routing = defineRouting({
  /** 支持的语言清单，顺序即语言切换器与 hreflang 的输出顺序 */
  locales: ["zh", "en"],

  /** 默认语言：URL 未携带语言或语言非法时回退到 zh */
  defaultLocale: "zh",

  /**
   * 语言前缀策略固定为 always，即所有页面路径都强制带 /zh 或 /en 前缀。
   * 目的是让每种语言的 URL 唯一且可被搜索引擎分别收录，避免根路径与默认语言内容重复（duplicate content）
   */
  localePrefix: "always",
});
