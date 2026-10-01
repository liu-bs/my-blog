/**
 * @file UserMenu.tsx
 * @description 桌面端用户菜单：加载中占位、未登录展示登录入口；
 *              登录后头像按钮弹出个人面板（个人中心/写作/设置/退出），
 *              支持鼠标悬停展开、点击切换（悬停展开后首次点击保持展开）、失焦与外点关闭；
 *              退出经 useLogoutRedirect 清理登录态并回跳
 */
"use client";

import { useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { LogIn, NotepadText, SquareArrowRightExit, BookUser, Columns3Cog } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials } from "@/lib/format";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";

/** 登录后菜单项配置（个人中心/写作/设置） */
export const userMenuItems = [
  { href: "/profile", labelKey: "profile", icon: BookUser },
  { href: "/write", labelKey: "write", icon: NotepadText },
  { href: "/settings", labelKey: "settings", icon: Columns3Cog },
] as const;

/**
 * UserMenu 用户菜单
 */
export function UserMenu() {
  const t = useTranslations("nav");

  /** 面板展开状态 */
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /** 全局登录用户与加载态 */
  const { user, loading } = useAuth();

  /** 是否已登录 */
  const isLoggedIn = !!user;

  /** 组件根元素引用，供外点关闭判定 */
  const userMenuRef = useRef<HTMLDivElement>(null);

  /** 本次展开是否由鼠标悬停触发：悬停展开后首次点击仅"钉住"面板而不收起 */
  const hoverOpenedRef = useRef(false);

  /** 面板 id（aria-controls 关联） */
  const panelId = useId();

  /** 用户显示名 */
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  /** 头像兜底首字母 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /** 退出登录：清理登录态后关闭菜单并跳转 */
  const handleLogout = useLogoutRedirect(() => setUserMenuOpen(false));

  /** 外点/Escape 关闭面板 */
  useDismissable(userMenuOpen, () => setUserMenuOpen(false), [userMenuRef]);

  // 用户信息加载中：先渲染占位，避免布局跳动
  if (loading && !user) {
    return <span aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  // 未登录：直接展示登录入口
  if (!isLoggedIn) {
    return (
      <Link href="/login" className="bar-btn">
        <LogIn size={18} strokeWidth={2.25} className="h-4.5 w-4.5 shrink-0" />
        {t("login")}
      </Link>
    );
  }

  return (
    <div
      ref={userMenuRef}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hoverOpenedRef.current = true;
        setUserMenuOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hoverOpenedRef.current = false;
        setUserMenuOpen(false);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setUserMenuOpen(false);
        }
      }}
    >
      <button
        onClick={() => {
          if (hoverOpenedRef.current) {
            hoverOpenedRef.current = false;
            setUserMenuOpen(true);
          } else {
            setUserMenuOpen((v) => !v);
          }
        }}
        aria-label={t("userMenu")}
        aria-expanded={userMenuOpen}
        aria-controls={panelId}
        className="icon-btn-ghost"
      >
        <Avatar
          initials={initials}
          src={user?.avatar || undefined}
          size="sm"
          alt={t("avatarAlt", { name: displayName })}
        />
      </button>

      <div
        className={`absolute top-full right-0 z-(--z-modal) pt-2 ${userMenuOpen ? "" : "pointer-events-none"}`}
      >
        <div
          id={panelId}
          className={`w-56 origin-top-right overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-(--shadow-lg) transition-[opacity,scale,visibility] duration-[var(--duration-fast)] ease-smooth ${
            userMenuOpen ? "visible scale-100 opacity-100" : "invisible scale-98 opacity-0"
          }`}
        >
          <div className="row-sm px-3.5 py-3">
            <Avatar
              initials={initials}
              src={user?.avatar || undefined}
              size="md"
              alt={t("avatarAlt", { name: displayName })}
            />
            <div className="min-w-0">
              <p className="m-0 truncate text-(length:--type-xs) leading-normal font-semibold text-heading">
                {user?.firstName} {user?.lastName}
              </p>

              <p className="m-0 truncate text-(length:--type-xs) leading-normal text-faint">
                @{user?.username}
              </p>
            </div>
          </div>

          <div className="mx-3 border-t border-stroke/60" />

          <div className="p-1.5">
            {userMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setUserMenuOpen(false)}
                  className="group row-sm min-h-9 rounded-md px-2.5 py-2 text-(length:--type-xs) leading-normal font-medium text-body transition-[background-color,color] duration-[var(--duration-fast)] ease-smooth hover:bg-btn-hover-bg hover:text-heading"
                >
                  <Icon
                    size={16}
                    strokeWidth={2.25}
                    className="h-4 w-4 shrink-0 text-muted transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-heading"
                  />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>

          <div className="mx-3 border-t border-stroke/60" />

          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="group row-sm min-h-9 w-full rounded-md px-2.5 py-2 text-(length:--type-xs) leading-normal font-medium text-muted transition-[background-color,color] duration-[var(--duration-fast)] ease-smooth hover:bg-state-error-bg hover:text-state-error"
            >
              <SquareArrowRightExit
                size={16}
                strokeWidth={2.25}
                className="h-4 w-4 shrink-0 transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-state-error"
              />
              {t("logout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
