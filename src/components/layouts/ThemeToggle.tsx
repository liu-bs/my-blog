/**
 * @file ThemeToggle.tsx
 * @description 明暗主题切换能力集合：useThemeMode 钩子（SSR 安全读取解析主题）、ThemeGlyph 图标、ThemeToggle 切换按钮；
 * 按钮内太阳/月亮双图标交叉位移过渡，桌面导航栏与移动端抽屉共用同一套钩子
 */
"use client";

import { useSyncExternalStore } from "react";
import { messages } from "@/texts";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/** 空订阅函数：主题状态由 next-themes 维护，此钩子无需外部订阅 */
const emptySubscribe = () => () => {};

/** 客户端快照读取：挂载后恒为浏览器环境 */
const isClient = () => true;

/** 服务端快照读取：SSR 阶段恒为 false，避免水合时读取 resolvedTheme 不一致 */
const isServer = () => false;

/** 导航栏主题图标统一尺寸配置 */
const NAV_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5" } as const;

/**
 * 读取当前主题模式并暴露切换方法的钩子
 * @returns isDark 当前是否为暗色主题；setDark 接收布尔值切换明暗
 * @warning SSR 首次渲染 isBrowser 为 false，isDark 恒为 false，需等客户端水合后才准确
 */
export function useThemeMode() {
  /* 借助 useSyncExternalStore 区分服务端/客户端快照，规避水合期读取 resolvedTheme 报错 */
  const isBrowser = useSyncExternalStore(emptySubscribe, isClient, isServer);
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = isBrowser && resolvedTheme === "dark";

  return { isDark, setDark: (dark: boolean) => setTheme(dark ? "dark" : "light") };
}

/**
 * 主题图标：暗色显月亮、亮色显太阳，供抽屉等场景复用
 * @param props.isDark 当前是否暗色主题
 */
export function ThemeGlyph({ isDark }: { isDark: boolean }) {
  const Icon = isDark ? Moon : Sun;
  return <Icon {...NAV_ICON} />;
}

/** 主题切换按钮（无入参），点击在明暗间切换，双图标交叉位移过渡 */
export function ThemeToggle() {
  const { isDark, setDark } = useThemeMode();

  return (
    /* 按钮根容器，overflow-hidden 裁掉位移出视口的图标 */
    <button
      onClick={() => setDark(!isDark)}
      aria-label={messages.nav.themeToggle}
      className="relative icon-btn-ghost overflow-hidden"
    >
      {/* 太阳图标：亮色态居中可见，暗色态下移旋转淡出 */}
      <span
        className={`absolute flex h-4.5 w-4.5 items-center justify-center transition-[opacity,translate,rotate] duration-[var(--duration-slow)] ease-smooth ${
          isDark ? "translate-y-4 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100"
        }`}
      >
        <Sun {...NAV_ICON} />
      </span>

      {/* 月亮图标：暗色态居中可见，亮色态上移旋转淡出 */}
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
