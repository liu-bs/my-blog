/**
 * @file ThemeToggle.tsx
 * @description 明暗主题切换（next-themes）：useThemeMode 用 useSyncExternalStore 区分服务端/客户端
 *              避免水合不一致；导出 glyph 与 hook 供 MobileMenu 复用；图标切换带旋转过渡动画
 */
"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/** 空订阅：仅为 useSyncExternalStore 提供稳定的订阅函数 */
const emptySubscribe = () => () => {};

/** 客户端快照 */
const isClient = () => true;

/** 服务端快照 */
const isServer = () => false;

/** 主题图标统一样式 */
const NAV_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5" } as const;

/**
 * 主题模式 Hook：服务端恒为亮色，客户端读 resolvedTheme，
 * 避免水合前后图标不一致
 * @returns isDark 是否暗色、setDark 切换主题
 */
export function useThemeMode() {
  const isBrowser = useSyncExternalStore(emptySubscribe, isClient, isServer);
  const { resolvedTheme, setTheme } = useTheme();

  /** 是否处于暗色主题（服务端/未解析时视为亮色） */
  const isDark = isBrowser && resolvedTheme === "dark";

  return { isDark, setDark: (dark: boolean) => setTheme(dark ? "dark" : "light") };
}

/**
 * 按主题渲染对应 glyph 图标
 */
export function ThemeGlyph({ isDark }: { isDark: boolean }) {
  const Icon = isDark ? Moon : Sun;
  return <Icon {...NAV_ICON} />;
}

/**
 * ThemeToggle 明暗主题切换按钮（日/月图标旋转过渡）
 */
export function ThemeToggle() {
  const { isDark, setDark } = useThemeMode();
  const t = useTranslations("nav");

  return (
    <button
      onClick={() => setDark(!isDark)}
      aria-label={t("themeToggle")}
      className="relative icon-btn-ghost overflow-hidden"
    >
      <span
        className={`absolute flex h-4.5 w-4.5 items-center justify-center transition-[opacity,translate,rotate] duration-[var(--duration-slow)] ease-smooth ${
          isDark ? "translate-y-4 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100"
        }`}
      >
        <Sun {...NAV_ICON} />
      </span>

      <span
        className={`absolute flex h-4.5 w-4.5 items-center justify-center transition-[opacity,translate,rotate] duration-[var(--duration-slow)] ease-smooth ${
          isDark ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-4 -rotate-90 opacity-0"
        }`}
      >
        <Moon {...NAV_ICON} />
      </span>
    </button>
  );
}
