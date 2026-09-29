/**
 * @file Navbar.tsx
 * @description 全站顶部导航栏：左侧品牌标识与桌面导航，右侧主题 / 语言 / 用户菜单；窄屏下右侧收起为移动端菜单。
 *              通过 sticky 吸顶并叠在内容之上（z-index 取自 --z-sticky），底部另有一条独立分隔线承担模糊边缘的视觉效果
 */
import { Link } from "@/i18n/navigation";
import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";

/**
 * Navbar 全站顶部导航
 * @description 高度由 CSS 变量 --nav-h 统一约束，移动端菜单与遮罩层都依赖该变量做定位，改高度只能改变量。
 *              响应式策略：桌面导航与右侧工具组以 md 断点切换，窄屏只保留 MobileMenu 的汉堡入口
 * @returns 吸顶导航栏
 */
export function Navbar() {
  const t = useTranslations("nav");
  return (
    <nav className="sticky top-0 z-(--z-sticky) nav-surface">
      <div className="container mx-auto flex h-(--nav-h) items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/* 品牌区：图标 + 站点名，整体可点击回到首页 */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 leading-normal whitespace-nowrap text-heading sm:gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-heading brand-logo-hover">
            <BookOpen size={20} strokeWidth={2.25} className="h-5 w-5" />
          </span>

          <span className="display-serif text-(length:--type-sm) font-semibold">{t("brand")}</span>
        </Link>

        {/* 桌面主导航 */}
        <NavLinks />

        {/* 右侧工具区：ml-auto 把整组推到右端 */}
        <div className="ml-auto flex items-center gap-1">
          {/* 桌面端：主题切换 / 语言切换 / 竖向分隔线 / 用户菜单 */}
          <div className="flex items-center gap-1 max-md:hidden">
            <ThemeToggle />
            <LanguageToggle />

            {/* 纯装饰性分隔线，不参与语义 */}
            <div className="mx-1 h-5 w-px shrink-0 bg-stroke-strong" aria-hidden="true" />
            <UserMenu />
          </div>
          {/* 窄屏端：汉堡菜单，内部再承载上述全部功能 */}
          <MobileMenu />
        </div>
      </div>

      {/* 吸顶时的底部渐变分隔线，纯装饰 */}
      <div className="nav-bar-separator" aria-hidden="true" />
    </nav>
  );
}
