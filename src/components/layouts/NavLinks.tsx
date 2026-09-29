/**
 * @file NavLinks.tsx
 * @description 桌面端导航链接组：渲染 site 配置里的固定导航项，按当前路径高亮激活项；
 *              每个链接额外挂一个隐藏的 pending 标记，供全局 CSS 在路由跳转期间显示加载反馈
 */
"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";

/**
 * NavPendingMarker 路由跳转态的隐藏标记
 * @description 必须是 Link 的子树才能通过 useLinkStatus 读取到该链接自身的跳转状态；
 *              这里把状态写进 data-pending 属性交给 CSS 驱动视觉反馈，屏幕阅读器不可见（sr-only）
 * @returns 一个隐藏的 span，pending 为真时带 data-pending 属性
 */
function NavPendingMarker() {
  const { pending } = useLinkStatus();
  return <span className="sr-only" data-pending={pending || undefined} />;
}

/**
 * NavLinks 桌面导航链接组
 * @description 宽屏显示、窄屏隐藏（窄屏改由 MobileMenu 承担）；
 *              激活判定交给 isRouteActive 统一处理，保证「首页仅精确匹配、其余按前缀匹配」的规则全站一致
 * @returns 横向排列的导航链接
 */
export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  /**
   * 判断某导航项是否为当前页
   * @param href 导航项目标路径（不含语言前缀）
   * @returns 激活返回 true
   */
  const isActive = (href: string) => isRouteActive(pathname, href);

  return (
    <div className="flex items-center gap-1 max-md:hidden">
      {/* 遍历站点导航配置；key 用 href 保证唯一 */}
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
            {/* 跳转等待态标记，供全局 CSS 消费 */}
            <NavPendingMarker />
          </Link>
        );
      })}
    </div>
  );
}
