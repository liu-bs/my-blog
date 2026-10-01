/**
 * @file MobileMenu.tsx
 * @description 移动端抽屉菜单：汉堡按钮 + Portal 渲染遮罩与面板（挂载后才渲染避免 SSR 报错）；
 *              含主导航、登录后的用户菜单项、主题/语言切换、退出登录；
 *              打开时锁定滚动并把焦点移入面板、Tab 循环焦点陷阱，关闭后焦点归还汉堡按钮；路由高亮基于 usePathname
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

/** 导航项图标映射 */
const NAV_ICONS = { home: Home, posts: FileText } as const;

/** 行内图标统一样式 */
const ROW_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5 shrink-0" } as const;

/**
 * MobileMenu 移动端抽屉菜单
 */
export function MobileMenu() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user, loading } = useAuth();
  const { isDark, setDark } = useThemeMode();
  const { locale, next, isPending, switchTo } = useLocaleSwitch();

  /** 抽屉展开状态 */
  const [mobileOpen, setMobileOpen] = useState(false);

  /** 是否已完成客户端挂载（Portal 仅挂载后渲染） */
  const [mounted, setMounted] = useState(false);

  /** 抽屉面板引用：焦点管理（打开时移入、Tab 陷阱） */
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /** 汉堡按钮引用：关闭后焦点归还 */
  const toggleRef = useRef<HTMLButtonElement>(null);

  /** 上一帧展开状态：仅在"开→关"时归还焦点 */
  const wasOpenRef = useRef(false);

  /** 是否已登录 */
  const isLoggedIn = !!user;

  /** 用户显示名 */
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  /** 头像兜底首字母 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /** 关闭抽屉 */
  const close = () => setMobileOpen(false);

  /** 退出登录：清理登录态后关闭抽屉并跳转 */
  const handleLogout = useLogoutRedirect(close);

  /** 当前路由是否命中导航项 */
  const isActive = (href: string) => isRouteActive(pathname, href);

  /** 挂载后才启用 Portal */
  useEffect(() => {
    setMounted(true);
  }, []);

  /** 外点/Escape 关闭，并锁定背景滚动 */
  useDismissable(mobileOpen, close, [mobileMenuRef, toggleRef], {
    lockScroll: true,
  });

  /** 焦点管理：打开时焦点移入面板，关闭时归还汉堡按钮 */
  useEffect(() => {
    if (mobileOpen) {
      mobileMenuRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  /** 焦点陷阱：Tab 在面板内首尾循环，阻止焦点逃逸到背景内容 */
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
      <button
        ref={toggleRef}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        aria-expanded={mobileOpen}
        className="icon-btn-ghost hidden max-md:flex"
      >
        {mobileOpen ? <X {...ROW_ICON} /> : <Menu {...ROW_ICON} />}
      </button>

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

            <div className="sheet-group">
              <button onClick={() => setDark(!isDark)} className="sheet-item-sub">
                <ThemeGlyph isDark={isDark} />
                {t("theme")}
                <span className="sheet-value">{isDark ? t("themeDark") : t("themeLight")}</span>
              </button>

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
