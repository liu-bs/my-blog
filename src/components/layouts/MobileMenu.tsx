/**
 * @file MobileMenu.tsx
 * @description 移动端导航抽屉：汉堡按钮开关，抽屉经 createPortal 挂到 body，包含用户身份区、主导航、
 * 用户菜单/登录注册、主题切换与退出登录分组；支持 Esc/遮罩关闭、Tab 焦点陷阱与滚动锁定
 */
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FileText, Home, LogIn, SquareArrowRightExit, UserPlus } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials, joinName } from "@shared/format";
import { ThemeGlyph, useThemeMode } from "./ThemeToggle";
import { userMenuItems } from "./UserMenu";

/** 主导航链接 key 对应的图标组件映射 */
const NAV_ICONS = { home: Home, posts: FileText } as const;

/** 抽屉内行元素图标统一尺寸配置 */
const ROW_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5 shrink-0" } as const;

/**
 * 移动端导航抽屉（无入参）
 * @warning 抽屉与遮罩仅在客户端挂载后（mounted）通过 portal 渲染，SSR 输出中不存在
 */
export function MobileMenu() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isDark, setDark } = useThemeMode();

  /* 抽屉是否展开 */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* 客户端已挂载标记，控制 portal 渲染时机 */
  const [mounted, setMounted] = useState(false);

  /* 抽屉面板元素引用，用于焦点管理与 useDismissable 外部点击判定 */
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /* 汉堡开关按钮引用，抽屉关闭后焦点归还至此 */
  const toggleRef = useRef<HTMLButtonElement>(null);

  /* 记录上一次展开状态，仅在"开→关"切换时归还焦点到按钮 */
  const wasOpenRef = useRef(false);

  const isLoggedIn = !!user;

  /* 用户全名（名+姓拼接），未登录为空串 */
  const displayName = joinName(user?.firstName ?? "", user?.lastName ?? "");

  /* 头像文字缩写，无头像图时兜底显示 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /* 关闭抽屉的统一方法 */
  const close = () => setMobileOpen(false);

  /* 退出登录处理：调用登出重定向逻辑并先关闭抽屉 */
  const handleLogout = useLogoutRedirect(close);

  /* 判断某 href 是否为当前激活路由 */
  const isActive = (href: string) => isRouteActive(pathname, href);

  /* 挂载完成后允许渲染 portal 内容 */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Esc 键与遮罩点击关闭抽屉，展开期间锁定页面滚动 */
  useDismissable(mobileOpen, close, [mobileMenuRef, toggleRef], {
    lockScroll: true,
  });

  /* 焦点跟随：打开聚焦抽屉，关闭归还焦点到汉堡按钮 */
  useEffect(() => {
    if (mobileOpen) {
      mobileMenuRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  /**
   * 抽屉内 Tab 键焦点陷阱：首/末元素间循环，防止焦点逃逸到遮罩后的页面
   * @param e React 键盘事件（绑定在抽屉面板 onKeyDown）
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
      {/* 汉堡开关按钮：仅移动端显示，展开时切换为 X 图标 */}
      <button
        ref={toggleRef}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? messages.nav.closeMenu : messages.nav.openMenu}
        aria-expanded={mobileOpen}
        className="icon-btn-ghost hidden max-md:flex"
      >
        {mobileOpen ? <X {...ROW_ICON} /> : <Menu {...ROW_ICON} />}
      </button>

      {/* 全屏遮罩层：portal 挂 body，点击任意处关闭，导航栏下方铺满 */}
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

      {/* 抽屉面板：portal 挂 body，关闭时 inert + aria-hidden 阻止交互与播报 */}
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
            {/* 已登录：用户身份区，头像+全名+用户名，点击跳转个人主页 */}
            {isLoggedIn && (
              <Link href="/profile" onClick={close} className="sheet-identity">
                <Avatar
                  initials={initials}
                  src={user?.avatar || undefined}
                  size="lg"
                  alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
                />

                {/* 用户姓名与 @用户名 */}
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

            {/* 主导航分组：首页/文章列表，激活项高亮，点击后关闭抽屉 */}
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
                    {messages.nav[link.key]}
                  </Link>
                );
              })}
            </div>

            {/* 已登录：用户功能菜单组（个人主页/写作/设置，与桌面 UserMenu 共用 userMenuItems）；
                未登录且校验完成：登录/注册入口组 */}
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
                      {messages.nav[item.labelKey]}
                    </Link>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <div className="sheet-group">
                  {/* 登录入口 */}
                  <Link href="/login" onClick={close} className="sheet-item-sub">
                    <LogIn {...ROW_ICON} />
                    {messages.nav.login}
                  </Link>
                  {/* 注册入口 */}
                  <Link href="/register" onClick={close} className="sheet-item-sub">
                    <UserPlus {...ROW_ICON} />
                    {messages.nav.register}
                  </Link>
                </div>
              )
            )}

            {/* 主题切换分组：点击翻转明暗并关闭抽屉，右侧显示当前模式 */}
            <div className="sheet-group">
              <button
                onClick={() => {
                  setDark(!isDark);
                  close();
                }}
                className="sheet-item-sub"
              >
                <ThemeGlyph isDark={isDark} />
                {messages.nav.theme}
                <span className="sheet-value">
                  {isDark ? messages.nav.themeDark : messages.nav.themeLight}
                </span>
              </button>
            </div>

            {/* 退出登录分组：仅已登录显示，危险色样式 */}
            {isLoggedIn && (
              <div className="sheet-group">
                <button onClick={handleLogout} className="sheet-item-sub sheet-item-danger">
                  <SquareArrowRightExit {...ROW_ICON} />
                  {messages.nav.logout}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
