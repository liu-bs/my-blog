/**
 * @file Navbar.tsx
 * @description 全站顶部导航栏，sticky 吸顶；左侧品牌 Logo，中部桌面导航链接，右侧主题切换、用户菜单（桌面）与移动端抽屉入口
 */
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { messages } from "@/texts";
import { ThemeToggle } from "./ThemeToggle";

import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";

/** 顶部导航栏（无入参），登录态由各子组件自行读取 useAuth */
export function Navbar() {
  return (
    /* 导航栏外层，sticky 吸顶，高度由 --nav-h 变量控制 */
    <nav className="sticky top-0 z-(--z-sticky) nav-surface">
      {/* 主行容器，左右留白约束到 container 宽度 */}
      <div className="container mx-auto flex h-(--nav-h) items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/* 品牌 Logo + 站点名，点击返回首页 */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 leading-normal whitespace-nowrap text-heading sm:gap-2.5"
        >
          {/* Logo 图标容器 */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-heading brand-logo-hover">
            <BookOpen size={20} strokeWidth={2.25} className="h-5 w-5" />
          </span>

          {/* 站点名文本 */}
          <span className="display-serif text-(length:--type-sm) font-semibold">
            {messages.nav.brand}
          </span>
        </Link>

        {/* 桌面端主导航链接组 */}
        <NavLinks />

        {/* 右侧操作区：主题切换 + 分隔线 + 用户菜单，移动端仅保留抽屉入口 */}
        <div className="ml-auto flex items-center gap-1">
          {/* 桌面端专属：主题切换与用户菜单 */}
          <div className="flex items-center gap-1 max-md:hidden">
            <ThemeToggle />

            <div className="mx-1 h-5 w-px shrink-0 bg-stroke-strong" aria-hidden="true" />
            <UserMenu />
          </div>

          {/* 移动端汉堡抽屉入口 */}
          <MobileMenu />
        </div>
      </div>

      {/* 底部装饰分隔线 */}
      <div className="nav-bar-separator" aria-hidden="true" />
    </nav>
  );
}
