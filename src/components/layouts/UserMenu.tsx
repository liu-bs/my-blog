/**
 * @file UserMenu.tsx
 * @description 桌面端导航栏用户菜单：未登录显示"登录"按钮，登录后头像触发下拉面板（个人主页/写作/设置/退出登录）；
 * 支持鼠标悬停展开、点击切换、焦点离开关闭；userMenuItems 配置同时被 MobileMenu 抽屉复用
 */
"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { LogIn, NotepadText, SquareArrowRightExit, BookUser, Columns3Cog } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials, joinName } from "@shared/format";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";

/** 登录后的功能菜单项配置：路由、文案 key 与图标，供桌面下拉与移动抽屉共用 */
export const userMenuItems = [
  { href: "/profile", labelKey: "profile", icon: BookUser },
  { href: "/write", labelKey: "write", icon: NotepadText },
  { href: "/settings", labelKey: "settings", icon: Columns3Cog },
] as const;

/** 桌面端用户菜单（无入参），登录态来自 useAuth */
export function UserMenu() {
  /* 下拉面板是否展开 */
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { user, loading } = useAuth();

  const isLoggedIn = !!user;

  /* 菜单根容器引用，用于 useDismissable 外部点击判定与 onBlur 捕获 */
  const userMenuRef = useRef<HTMLDivElement>(null);

  /* 标记本次展开是否由悬停触发，决定点击按钮时的切换方向 */
  const hoverOpenedRef = useRef(false);

  /* 下拉面板唯一 id，供按钮 aria-controls 关联 */
  const panelId = useId();

  /* 用户全名（名+姓拼接） */
  const displayName = joinName(user?.firstName ?? "", user?.lastName ?? "");

  /* 头像文字缩写兜底 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /* 退出登录处理：登出重定向并关闭面板 */
  const handleLogout = useLogoutRedirect(() => setUserMenuOpen(false));

  /* 点击面板外部时关闭下拉 */
  useDismissable(userMenuOpen, () => setUserMenuOpen(false), [userMenuRef]);

  /* 登录态校验中且无缓存用户：渲染等高占位，避免导航栏宽度跳动 */
  if (loading && !user) {
    return <span aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  /* 未登录：仅渲染"登录"入口按钮 */
  if (!isLoggedIn) {
    return (
      <Link href="/login" className="bar-btn">
        <LogIn size={18} strokeWidth={2.25} className="h-4.5 w-4.5 shrink-0" />
        {messages.nav.login}
      </Link>
    );
  }

  return (
    /* 菜单根容器：悬停开合（仅 mouse 指针类型），焦点移出容器时关闭面板 */
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
      {/* 头像触发按钮：悬停展开状态下点击保持展开，非悬停来源时切换开合 */}
      <button
        onClick={() => {
          if (hoverOpenedRef.current) {
            hoverOpenedRef.current = false;
            setUserMenuOpen(true);
          } else {
            setUserMenuOpen((v) => !v);
          }
        }}
        aria-label={messages.nav.userMenu}
        aria-expanded={userMenuOpen}
        aria-controls={panelId}
        className="icon-btn-ghost"
      >
        {/* 触发按钮内的头像，尺寸 sm，无图时用缩写兜底 */}
        <Avatar
          initials={initials}
          src={user?.avatar || undefined}
          size="sm"
          alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
        />
      </button>

      {/* 下拉面板定位层，锚定在按钮下方右对齐 */}
      <div
        className={`absolute top-full right-0 z-(--z-modal) pt-2 ${userMenuOpen ? "" : "pointer-events-none"}`}
      >
        {/* 下拉面板容器，展开态控制可见性、缩放与透明度动画 */}
        <div
          id={panelId}
          className={`w-56 origin-top-right overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-(--shadow-lg) transition-[opacity,scale,visibility] duration-[var(--duration-fast)] ease-smooth ${
            userMenuOpen ? "visible scale-100 opacity-100" : "invisible scale-98 opacity-0"
          }`}
        >
          {/* 面板头部：展示当前登录用户头像、姓名与 @用户名 */}
          <div className="row-sm px-3.5 py-3">
            <Avatar
              initials={initials}
              src={user?.avatar || undefined}
              size="md"
              alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
            />
            <div className="min-w-0">
              {/* 用户姓名（名+姓拼接） */}
              <p className="m-0 truncate text-(length:--type-xs) leading-normal font-semibold text-heading">
                {displayName}
              </p>

              {/* 用户登录名 */}
              <p className="m-0 truncate text-(length:--type-xs) leading-normal text-faint">
                @{user?.username}
              </p>
            </div>
          </div>

          {/* 头部分隔线 */}
          <div className="mx-3 border-t border-stroke/60" />

          {/* 导航菜单项组，渲染 userMenuItems，点击后关闭面板并跳转 */}
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
                  {/* 菜单项图标 */}
                  <Icon
                    size={16}
                    strokeWidth={2.25}
                    className="h-4 w-4 shrink-0 text-muted transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-heading"
                  />
                  {messages.nav[item.labelKey]}
                </Link>
              );
            })}
          </div>

          {/* 菜单与退出登录的分隔线 */}
          <div className="mx-3 border-t border-stroke/60" />

          {/* 退出登录按钮组 */}
          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="group row-sm min-h-9 w-full rounded-md px-2.5 py-2 text-(length:--type-xs) leading-normal font-medium text-muted transition-[background-color,color] duration-[var(--duration-fast)] ease-smooth hover:bg-state-error-bg hover:text-state-error"
            >
              {/* 退出图标 */}
              <SquareArrowRightExit
                size={16}
                strokeWidth={2.25}
                className="h-4 w-4 shrink-0 transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-state-error"
              />
              {messages.nav.logout}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
