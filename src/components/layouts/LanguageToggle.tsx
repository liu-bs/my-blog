/**
 * @file LanguageToggle.tsx
 * @description 语言切换（中文/英文）：useLocaleSwitch 在当前路径（保留查询参数）上切换 locale，
 *              经 useTransition 软导航；导出 glyph 与 hook 供 MobileMenu 复用
 */
"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";

/** 各语言的展示文案 */
export const LOCALE_LABELS: Record<Locale, string> = { zh: "中文", en: "English" };

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

/** 语言 glyph 图标 */
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

/** 语言 glyph 图标 */
function AGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M6.5 19.5 12 4.5l5.5 15" />
      <path d="M8.7 13.5h6.6" />
    </svg>
  );
}

/**
 * 按当前语言渲染对应 glyph 图标
 */
export function LocaleGlyph({ locale }: { locale: Locale }) {
  return locale === "zh" ? <WenGlyph /> : <AGlyph />;
}

/**
 * 语言切换 Hook：提供当前/下一语言、切换中状态与切换方法
 * @returns locale 当前语言、next 待切换语言、isPending 切换中、switchTo 切换方法
 */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  /** 切换中的 transition 标记，期间禁用切换按钮 */
  const [isPending, startTransition] = useTransition();

  /** 待切换的目标语言 */
  const next: Locale = locale === "zh" ? "en" : "zh";

  /**
   * 切换语言：在当前路径上 replace 并携带原查询参数，i18n 路由按目标 locale 生成前缀
   */
  const switchTo = (target: Locale) => {
    if (isPending || target === locale) return;

    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { locale: target });
    });
  };

  return { locale, next, isPending, switchTo };
}

/**
 * LanguageToggle 语言切换按钮（桌面端，展示当前语言标识）
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
