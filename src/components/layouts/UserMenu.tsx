/**
 * @file UserMenu.tsx
 * @description 桌面端用户菜单：未登录显示登录入口，已登录显示头像按钮与下拉面板（个人资料 / 写作 / 设置 / 退出）。
 *              面板支持鼠标悬停展开、点击切换、点击外部或 ESC 关闭、焦点移出自动收起
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

/**
 * 已登录用户在导航栏可进入的功能入口
 * @description 抽成常量是为了让桌面下拉与移动端菜单复用同一份配置，避免两处入口不同步；
 *              labelKey 对应 nav 命名空间下的 i18n key
 */
export const userMenuItems = [
  { href: "/profile", labelKey: "profile", icon: BookUser },
  { href: "/write", labelKey: "write", icon: NotepadText },
  { href: "/settings", labelKey: "settings", icon: Columns3Cog },
] as const;

/**
 * UserMenu 用户菜单
 * @description 三种渲染分支，顺序即优先级：
 *              1）loading 且无缓存用户 —— 渲染等宽占位 span，防止导航栏右侧在用户态就绪前后发生横向抖动；
 *              2）未登录 —— 渲染跳转 /login 的按钮；
 *              3）已登录 —— 渲染头像按钮与下拉面板。
 *              展开时机有两条：鼠标悬停（仅 pointerType 为 mouse）与点击；键盘 / 触屏用户走点击路径
 * @returns 占位符 / 登录按钮 / 用户下拉菜单
 */
export function UserMenu() {
  const t = useTranslations("nav");

  /** 下拉面板是否展开 */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  const isLoggedIn = !!user;

  /** 菜单根节点引用，供 useDismissable 判断点击是否落在菜单之外 */
  const userMenuRef = useRef<HTMLDivElement>(null);

  /**
   * 标记「本次展开是否由鼠标悬停触发」
   * @description 悬停已经展开了面板，此时用户点击头像的意图是「固定住面板」而非「关闭」；
   *              若不做区分，点击会立刻把刚展开的面板切换关闭，体验上像是点不动
   */
  const hoverOpenedRef = useRef(false);

  /** 面板 id，用于给触发按钮建立 aria-controls 关联，同一页面多次使用也不会冲突 */
  const panelId = useId();

  /** 姓名拼接结果，用于头像的 alt 与面板顶部展示 */
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  /** 头像无图时的首字母兜底 */
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  /** 退出登录：先收起面板再走统一的重定向退出流程 */
  const handleLogout = useLogoutRedirect(() => setUserMenuOpen(false));

  /** 点击面板外部或按 ESC 时收起面板 */
  useDismissable(userMenuOpen, () => setUserMenuOpen(false), [userMenuRef]);

  // 用户态未知且无缓存：用与头像等大的占位符占位，避免右侧工具区跳动
  if (loading && !user) {
    return <span aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  // 未登录：直接给登录入口，不展示下拉
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
        // 仅鼠标悬停展开；触屏的 pointerType 不是 mouse，避免触摸时误触发展开
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
        // 焦点仍在菜单内部（relatedTarget 在容器内）时不关闭，保证键盘 Tab 遍历可用
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setUserMenuOpen(false);
        }
      }}
    >
      {/* 头像触发按钮：悬停已展开时点击只做「确认保持展开」，否则正常切换 */}
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

      {/* 定位外壳：pt-2 留出鼠标从按钮移到面板之间的空隙，防止指针中途离开容器导致面板收起 */}
      <div
        className={`absolute top-full right-0 z-(--z-modal) pt-2 ${userMenuOpen ? "" : "pointer-events-none"}`}
      >
        {/* 下拉面板本体：关闭时用 invisible 而非不渲染，以便过渡动画生效 */}
        <div
          id={panelId}
          className={`w-56 origin-top-right overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-(--shadow-lg) transition-[opacity,scale,visibility] duration-[var(--duration-fast)] ease-smooth ${
            userMenuOpen ? "visible scale-100 opacity-100" : "invisible scale-98 opacity-0"
          }`}
        >
          {/* 面板顶部：当前用户身份摘要 */}
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

          {/* 分隔线（视觉分组，无语义） */}
          <div className="mx-3 border-t border-stroke/60" />

          {/* 功能入口组：点击后立即收起面板，避免跳转后旧面板仍挂在屏幕上 */}
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

          {/* 分隔线（视觉分组，无语义） */}
          <div className="mx-3 border-t border-stroke/60" />

          {/* 危险操作组：退出登录，独立分组并采用错误态配色以示区别 */}
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
