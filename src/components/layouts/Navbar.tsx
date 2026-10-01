/**
 * @file Navbar.tsx
 * @description 顶部导航栏（sticky）：品牌入口、桌面端主导航（NavLinks）、主题/语言切换与用户菜单（UserMenu），
 *              移动端收纳进 MobileMenu 抽屉
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
 * Navbar 顶部导航栏
 */
export function Navbar() {
  const t = useTranslations("nav");
  return (
    <nav className="sticky top-0 z-(--z-sticky) nav-surface">
      <div className="container mx-auto flex h-(--nav-h) items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 leading-normal whitespace-nowrap text-heading sm:gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-heading brand-logo-hover">
            <BookOpen size={20} strokeWidth={2.25} className="h-5 w-5" />
          </span>

          <span className="display-serif text-(length:--type-sm) font-semibold">{t("brand")}</span>
        </Link>

        <NavLinks />

        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center gap-1 max-md:hidden">
            <ThemeToggle />
            <LanguageToggle />

            <div className="mx-1 h-5 w-px shrink-0 bg-stroke-strong" aria-hidden="true" />
            <UserMenu />
          </div>

          <MobileMenu />
        </div>
      </div>

      <div className="nav-bar-separator" aria-hidden="true" />
    </nav>
  );
}
