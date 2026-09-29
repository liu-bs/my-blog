/**
 * @file LanguageToggle.tsx
 * @description 语言切换相关的公共实现：语言标签映射、语言字形图标、可复用的切换 Hook，以及导航栏上的切换按钮。
 *              切换基于 next-intl 的 i18n 路由，只替换 URL 的语言前缀，保留用户当前所在路径
 */
"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";

/** 各语言的展示名称，用于移动端菜单里显示「当前语言」的取值 */
export const LOCALE_LABELS: Record<Locale, string> = { zh: "中文", en: "English" };

/** 语言字形 svg 的公共属性，集中定义避免两个字形出现不一致的线宽与尺寸 */
const GLYPH_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-4.5 w-4.5",
  "aria-hidden": true,
} as const;

/**
 * 中文语言字形图标（「文」的简化笔画）
 * @returns 纯装饰性 svg，语义由所在按钮的 aria-label 承载
 */
function WenGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M12 4.5v1" />
      <path d="M5 9h14" />
      <path d="M6.5 13.5 17.5 20" />
      <path d="M17.5 13.5 6.5 20" />
    </svg>
  );
}

/**
 * 英文语言字形图标（字母 A 的简化笔画）
 * @returns 纯装饰性 svg，语义由所在按钮的 aria-label 承载
 */
function AGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M6.5 19.5 12 4.5l5.5 15" />
      <path d="M8.7 13.5h6.6" />
    </svg>
  );
}

/**
 * 按语言返回对应的字形图标
 * @param props 组件入参
 * @param props.locale 目标语言
 * @returns 中文返回「文」字形，其余返回字母 A 字形
 */
export function LocaleGlyph({ locale }: { locale: Locale }) {
  return locale === "zh" ? <WenGlyph /> : <AGlyph />;
}

/**
 * 语言切换 Hook
 * @description 封装「读取当前语言 → 计算目标语言 → 切换」的完整逻辑，供桌面端下拉与移动端菜单共用。
 *              切换时用 router.replace 只替换语言前缀，pathname 取自 i18n 导航封装（已剥离前缀），
 *              因此用户停留在同一页面而非被强制回到首页；
 *              并用 useTransition 把路由跳转标记为非紧急更新，isPending 期间禁用按钮防止重复触发
 * @returns 当前语言、下一个待切换的语言、切换是否进行中、以及执行切换的方法
 */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  /** 路由切换的过渡态；用于给切换按钮加禁用与 loading 表现 */
  const [isPending, startTransition] = useTransition();

  /** 在 zh / en 之间二选一的目标语言 */
  const next: Locale = locale === "zh" ? "en" : "zh";

  /**
   * 切换到指定语言
   * @description 已是目标语言或正在切换中则直接忽略，避免无意义的路由跳转与竞态
   * @param target 目标语言
   */
  const switchTo = (target: Locale) => {
    if (isPending || target === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: target });
    });
  };

  return { locale, next, isPending, switchTo };
}

/**
 * LanguageToggle 语言切换按钮
 * @description 单按钮循环切换：点击即在当前语言与另一语言间取反，按钮文字直接显示当前语言代码
 * @returns 显示当前 locale 的图标按钮，切换进行中时禁用
 */
export function LanguageToggle() {
  const t = useTranslations("nav");
  const { locale, next, isPending, switchTo } = useLocaleSwitch();

  return (
    <button
      onClick={() => switchTo(next)}
      disabled={isPending}
      aria-label={t("languageToggle")}
      className="icon-btn-ghost text-(length:--type-xs) leading-normal font-medium lowercase disabled:opacity-50"
    >
      {locale}
    </button>
  );
}
