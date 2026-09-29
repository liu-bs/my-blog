/**
 * @file i18n.d.ts
 * @description next-intl 的类型增强声明：把项目真实的 Locale 与 Messages 结构注入 next-intl 的 AppConfig，
 * 从而让 useTranslations / getTranslations 等 API 获得命名空间与 key 的字面量提示和拼写校验
 */
import { routing } from "./routing";
import zh from "./messages/zh";

declare module "next-intl" {
  interface AppConfig {
    /** 收窄 next-intl 的全局 Locale 类型，使 useLocale() / usePathname() 等返回值具备具体字面量类型 */
    Locale: (typeof routing.locales)[number];

    /**
     * 语言包结构以中文包 zh 为基准，英文包在运行时须与之同构。
     * 声明后 useTranslations 会据此提示可用的命名空间与 key：
     * t('post') 能提示命名空间，t('post')('title') 能提示并校验具体 key 拼写；
     * 中文包增删 key 时英文包会同步出现类型错误，以此保证两种语言 key 始终对齐
     * @warning 本声明只约束 next-intl 的翻译 API；lib/message.ts 的 msg() 类型来自其自身的反馈词表，不走这里
     */
    Messages: typeof zh;
  }
}
