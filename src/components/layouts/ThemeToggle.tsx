/**
 * @file ThemeToggle.tsx
 * @description 主题切换相关的公共实现：一个 hydration 安全的主题 Hook、主题字形图标，以及导航栏上的切换按钮。
 *              主题状态由 next-themes 托管，切换结果写在 html 的 class 上，组件本身不持有状态
 */
"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/** 空订阅函数：本 Hook 不需要订阅任何外部数据源，仅借用 useSyncExternalStore 区分服务端 / 客户端快照 */
const emptySubscribe = () => () => {};

/** 客户端快照：恒为 true */
const isClient = () => true;

/** 服务端快照：恒为 false，保证首屏服务端渲染结果稳定，不依赖无法在服务端获知的主题 */
const isServer = () => false;

/** 主题图标的公共属性，保证两处引用（切换按钮与移动端菜单）尺寸与线宽一致 */
const NAV_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5" } as const;

/**
 * 主题模式 Hook
 * @description 服务端无法得知用户主题，若直接读取 resolvedTheme 会导致首屏渲染结果与客户端不一致而产生 hydration 报错；
 *              这里用 useSyncExternalStore 的「服务端快照返回 false」把首帧统一降级为亮色，
 *              待客户端接管后再反映真实主题，从而在不使用 useEffect 二次渲染的前提下规避闪烁与不匹配
 * @returns 当前是否为暗色，以及设定明暗的方法
 */
export function useThemeMode() {
  const isBrowser = useSyncExternalStore(emptySubscribe, isClient, isServer);
  const { resolvedTheme, setTheme } = useTheme();

  /** 仅当已进入客户端且 next-themes 解析出 dark 时才认定为暗色 */
  const isDark = isBrowser && resolvedTheme === "dark";

  return { isDark, setDark: (dark: boolean) => setTheme(dark ? "dark" : "light") };
}

/**
 * 主题字形图标
 * @param props 组件入参
 * @param props.isDark 当前是否为暗色主题
 * @returns 暗色显示月亮，亮色显示太阳
 */
export function ThemeGlyph({ isDark }: { isDark: boolean }) {
  const Icon = isDark ? Moon : Sun;
  return <Icon {...NAV_ICON} />;
}

/**
 * ThemeToggle 主题切换按钮
 * @description 两个图标叠放在同一位置，通过位移 + 旋转 + 透明度在明暗之间做交叉过渡，而不改变按钮尺寸；
 *              因此两个 span 始终渲染、只切换类名，避免动画期间出现布局跳动
 * @returns 显示太阳 / 月亮的图标按钮
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
      {/* 太阳：暗色时向下移出 + 旋转消失 */}
      <span
        className={`absolute flex h-4.5 w-4.5 items-center justify-center transition-[opacity,translate,rotate] duration-[var(--duration-slow)] ease-smooth ${
          isDark ? "translate-y-4 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100"
        }`}
      >
        <Sun {...NAV_ICON} />
      </span>
      {/* 月亮：亮色时向上移出 + 反向旋转消失 */}
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
