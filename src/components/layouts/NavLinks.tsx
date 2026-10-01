/**
 * @file NavLinks.tsx
 * @description 桌面端主导航链接：基于 usePathname 判定当前路由高亮（layout 已包 Suspense 以兼容 PPR 预渲染）；
 *              每个链接内嵌 NavPendingMarker，经 useLinkStatus 暴露导航 pending 态供样式使用
 */
"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";

/** 导航 pending 标记：仅渲染 sr-only 元素并透出 data-pending 属性 */
function NavPendingMarker() {
  const { pending } = useLinkStatus();
  return <span className="sr-only" data-pending={pending || undefined} />;
}

/**
 * NavLinks 主导航链接组
 */
export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  /** 当前路由是否命中导航项 */
  const isActive = (href: string) => isRouteActive(pathname, href);

  return (
    <div className="flex items-center gap-1 max-md:hidden">
      {NAV_LINKS.map((link) => {
        const active = isActive(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={active ? "nav-item nav-item-on" : "nav-item"}
          >
            {t(link.key)}

            <NavPendingMarker />
          </Link>
        );
      })}
    </div>
  );
}
