/**
 * @file NavLinks.tsx
 * @description 桌面端顶部主导航链接组，按 NAV_LINKS 配置渲染，当前路由高亮（aria-current + nav-item-on）；
 * 借助 useLinkStatus 输出待跳转标记，配合全局进度条动画
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLinkStatus } from "next/link";
import { messages } from "@/texts";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";

/**
 * 单个导航链接的"待加载"标记：包裹在 Link 内以读取该链接的 useLinkStatus，
 * 输出隐藏的 data-pending 属性供 CSS 挂进度动效
 */
function NavPendingMarker() {
  const { pending } = useLinkStatus();
  return <span className="sr-only" data-pending={pending || undefined} />;
}

/** 桌面端主导航链接组（无入参，链接项取自 NAV_LINKS 配置） */
export function NavLinks() {
  const pathname = usePathname();
  /* 判断某 href 是否为当前激活路由 */
  const isActive = (href: string) => isRouteActive(pathname, href);

  return (
    /* 链接组外层容器，移动端隐藏（改由 MobileMenu 抽屉承载） */
    <div className="flex items-center gap-1 max-md:hidden">
      {NAV_LINKS.map((link) => {
        const active = isActive(link.href);

        return (
          /* 单个导航链接，激活态追加 nav-item-on 并设 aria-current=page */
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={active ? "nav-item nav-item-on" : "nav-item"}
          >
            {messages.nav[link.key]}

            {/* 该链接的待加载状态标记 */}
            <NavPendingMarker />
          </Link>
        );
      })}
    </div>
  );
}
