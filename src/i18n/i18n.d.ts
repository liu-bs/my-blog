/**
 * @file i18n.d.ts
 * @description next-intl 的全局类型增强声明：将 AppConfig 的 Locale 与 Messages 绑定到
 *              本项目的语言列表与中文语言包结构，使 useTranslations 的 key 获得完整类型提示与拼写检查
 */
import { routing } from "./routing";
import zh from "./messages/zh";

declare module "next-intl" {
  /** 扩展 next-intl 的全局配置接口 */
  interface AppConfig {
    /** 可用语言类型，与 routing.locales 保持一致 */
    Locale: (typeof routing.locales)[number];

    /** 消息文案结构类型，以 zh 包为基准，en 包经 Messages 约束保持同构 */
    Messages: typeof zh;
  }
}
