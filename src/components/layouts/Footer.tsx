/**
 * @file Footer.tsx
 * @description 页脚（服务端组件）：版权信息与站点标语
 */
import { useTranslations } from "next-intl";
import { Container } from "../ui/Container";

/**
 * Footer 页脚
 */
export function Footer() {
  const t = useTranslations("footer");

  const tNav = useTranslations("nav");

  return (
    <footer className="border-t border-stroke bg-page py-10">
      <Container className="flex flex-wrap items-center justify-between gap-4 text-(length:--type-xs) leading-normal text-muted max-md:flex-col max-md:gap-3 max-md:text-center">
        <span className="inline-flex items-center font-medium tracking-[0.01em]">
          {t("copyright", { site: tNav("brand"), author: "Hui Shu" })}
        </span>

        <span className="display-serif text-(length:--type-base) tracking-wide text-muted">
          {t("tagline")}
        </span>
      </Container>
    </footer>
  );
}
