/**
 * @file MobileMenu.tsx
 * @description 窄屏（md 断点以下）主导航：汉堡按钮 + 经 portal 挂到 body 的抽屉面板与遮罩。
 *              抽屉内聚合了导航链接、用户身份、功能入口、主题与语言切换、退出登录，使窄屏无需常驻多个工具按钮
 * @warning 面板与遮罩都用 portal 渲染，因此不受导航栏 sticky 层叠上下文限制；相应地，焦点管理必须手动补齐
 */
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, X, FileText, Home, LogIn, SquareArrowRightExit, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials } from "@/lib/format";
import { ThemeGlyph, useThemeMode } from "./ThemeToggle";
import { LocaleGlyph, LOCALE_LABELS, useLocaleSwitch } from "./LanguageToggle";
import { userMenuItems } from "./UserMenu";

/** 导航项 key 到图标的映射；NAV_LINKS 的 key 目前只有 home / posts 两种 */
const NAV_ICONS = { home: Home, posts: FileText } as const;

/** 抽屉内每一行图标的公共属性，统一尺寸与线宽 */
const ROW_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5 shrink-0" } as const;

/**
 * MobileMenu 窄屏主导航抽屉
 * @description 三处关键实现：
 *              1）mounted —— portal 需要 document，只有挂载后才能安全渲染，同时避免服务端渲染阶段访问 DOM；
 *              2）useDismissable —— 统一处理点击遮罩 / 面板外与 ESC 关闭，并锁定背景滚动；
 *              3）焦点管理 —— 展开时把焦点移入面板，收起时归还给汉堡按钮，再用 handleTrap 把 Tab 循环限制在面板内
 * @returns 汉堡切换按钮，以及按需渲染的遮罩与抽屉
 */
export function MobileMenu() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user, loading } = useAuth();
  const { isDark, setDark } = useThemeMode();
  const { locale, next, isPending, switchTo } = useLocaleSwitch();

  /** 抽屉是否展开 */
  const [mobileOpen, setMobileOpen] = useState(false);

  /** 是否已完成客户端挂载；portal 依赖真实 DOM，未挂载前不渲染任何浮层 */
  const [mounted, setMounted] = useState(false);

  /** 抽屉根节点引用，用于焦点管理与点击外部的判定范围 */
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /** 汉堡按钮引用，收起时把焦点归还到它，保证键盘操作位置可预测 */
  const toggleRef = useRef<HTMLButtonElement>(null);

  /** 记录上一次的展开状态，用于区分「初始未展开」与「由展开变为收起」，只在后者归还焦点 */
  const wasOpenRef = useRef(false);

  const isLoggedIn = !!user;

  /** 姓名拼接结果，用于抽屉顶部身份卡与头像 alt */
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  /** 头像无图时的首字母兜底 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /** 收起抽屉 */
  const close = () => setMobileOpen(false);

  /** 退出登录：先收起抽屉再走统一的重定向退出流程 */
  const handleLogout = useLogoutRedirect(close);

  /**
   * 判断导航项是否为当前页
   * @param href 目标路径（不含语言前缀）
   * @returns 激活返回 true
   */
  const isActive = (href: string) => isRouteActive(pathname, href);

  /** 标记已挂载，打开 portal 的渲染开关 */
  useEffect(() => {
    setMounted(true);
  }, []);

  /** 点击抽屉 / 汉堡按钮之外的区域或按 ESC 时收起，并锁定背景滚动（抽屉是全屏浮层，滚动穿透会很难受） */
  useDismissable(mobileOpen, close, [mobileMenuRef, toggleRef], {
    lockScroll: true,
  });

  /**
   * 展开 / 收起时的焦点转移
   * @description 展开后焦点进入抽屉，避免焦点留在被遮罩覆盖的页面上；
   *              仅有「曾经展开过」才在收起时归还焦点给汉堡按钮，防止首次渲染时误抢焦点
   */
  useEffect(() => {
    if (mobileOpen) {
      mobileMenuRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  /**
   * Tab 焦点陷阱
   * @description 抽屉是全屏模态浮层，必须在首尾可聚焦元素之间循环，否则 Tab 会跑到被遮挡的页面内容上；
   *              可聚焦元素每次按键时实时查询，以适配登录态变化导致的条目增减
   * @param e 抽屉容器上的键盘事件
   */
  const handleTrap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !mobileOpen) return;
    const root = mobileMenuRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* 汉堡按钮：仅窄屏可见，宽屏由桌面工具组承担 */}
      <button
        ref={toggleRef}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        aria-expanded={mobileOpen}
        className="icon-btn-ghost hidden max-md:flex"
      >
        {mobileOpen ? <X {...ROW_ICON} /> : <Menu {...ROW_ICON} />}
      </button>

      {/* 遮罩层：从导航栏下沿铺满剩余视口，点击即收起 */}
      {mounted &&
        createPortal(
          <div
            className={`fixed top-(--nav-h) right-0 bottom-0 left-0 z-(--z-overlay) modal-overlay transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth ${
              mobileOpen
                ? "pointer-events-auto visible opacity-100"
                : "pointer-events-none invisible opacity-0"
            }`}
            onClick={close}
            aria-hidden="true"
          />,
          document.body,
        )}

      {/* 抽屉面板：始终存在于 DOM，用 visible / inert 控制可见与可交互，保证过渡动画能播放 */}
      {mounted &&
        createPortal(
          <div
            ref={mobileMenuRef}
            tabIndex={-1}
            onKeyDown={handleTrap}
            aria-hidden={!mobileOpen}
            inert={!mobileOpen ? true : undefined}
            className={`mobile-sheet transition-[opacity,visibility,translate] duration-[var(--duration-fast)] ease-smooth ${
              mobileOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-1 opacity-0"
            }`}
          >
            {/* 身份卡：已登录时展示，点击进入个人主页并顺带收起抽屉 */}
            {isLoggedIn && (
              <Link href="/profile" onClick={close} className="sheet-identity">
                <Avatar
                  initials={initials}
                  src={user?.avatar || undefined}
                  size="lg"
                  alt={t("avatarAlt", { name: displayName })}
                />

                <span className="min-w-0">
                  <span className="block truncate text-(length:--type-xs) leading-snug font-semibold text-heading">
                    {displayName}
                  </span>
                  <span className="block truncate text-(length:--type-xs) leading-snug text-faint">
                    @{user?.username}
                  </span>
                </span>
              </Link>
            )}

            {/* 主导航组：与桌面 NavLinks 共用 NAV_LINKS 配置 */}
            <div className="sheet-group">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                const Icon = NAV_ICONS[link.key];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    className={active ? "sheet-item sheet-item-on" : "sheet-item"}
                  >
                    <Icon {...ROW_ICON} />
                    {t(link.key)}
                  </Link>
                );
              })}
            </div>

            {/* 第二组：已登录展示功能入口，未登录只在用户态确定后展示登录 / 注册，避免 loading 期间闪出错误入口 */}
            {isLoggedIn ? (
              <div className="sheet-group">
                {userMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="sheet-item-sub"
                    >
                      <Icon {...ROW_ICON} />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <div className="sheet-group">
                  <Link href="/login" onClick={close} className="sheet-item-sub">
                    <LogIn {...ROW_ICON} />
                    {t("login")}
                  </Link>
                  <Link href="/register" onClick={close} className="sheet-item-sub">
                    <UserPlus {...ROW_ICON} />
                    {t("register")}
                  </Link>
                </div>
              )
            )}

            {/* 偏好设置组：主题与语言，均为就地切换且不关闭抽屉（用户可能想连续调整） */}
            <div className="sheet-group">
              {/* 主题切换：按钮内直接回显当前明暗 */}
              <button onClick={() => setDark(!isDark)} className="sheet-item-sub">
                <ThemeGlyph isDark={isDark} />
                {t("theme")}
                <span className="sheet-value">{isDark ? t("themeDark") : t("themeLight")}</span>
              </button>
              {/* 语言切换：切换中禁用，防止连点造成多次路由跳转 */}
              <button
                onClick={() => switchTo(next)}
                disabled={isPending}
                className="sheet-item-sub disabled:opacity-50"
              >
                <LocaleGlyph locale={locale} />
                {t("language")}
                <span className="sheet-value">{LOCALE_LABELS[locale]}</span>
              </button>
            </div>

            {/* 退出登录：独立分组并用危险色区分 */}
            {isLoggedIn && (
              <div className="sheet-group">
                <button onClick={handleLogout} className="sheet-item-sub sheet-item-danger">
                  <SquareArrowRightExit {...ROW_ICON} />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
