/**
 * @file Footer.tsx
 * @description 全站页脚：左侧版权声明（站点名与作者名参与插值）、右侧 slogan；纯服务端组件，随当前语言渲染
 */
import { useTranslations } from "next-intl";
import { Container } from "../ui/Container";

/**
 * Footer 全站页脚
 * @description 属于服务端组件，不依赖任何客户端状态；作者名是站点固定信息，直接写死在插值参数里而不走 i18n
 * @returns 页脚容器，窄屏下自动改为纵向居中排列
 */
export function Footer() {
  const t = useTranslations("footer");

  const tNav = useTranslations("nav");

  return (
    <footer className="border-t border-stroke bg-page py-10">
      <Container className="flex flex-wrap items-center justify-between gap-4 text-(length:--type-xs) leading-normal text-muted max-md:flex-col max-md:gap-3 max-md:text-center">
        {/* 版权行：站点名复用 nav 命名空间的品牌名，保证与导航栏一致 */}
        <span className="inline-flex items-center font-medium tracking-[0.01em]">
          {t("copyright", { site: tNav("brand"), author: "Hui Shu" })}
        </span>
        {/* slogan：使用衬线字体与正文字号形成视觉对比 */}
        <span className="display-serif text-(length:--type-base) tracking-wide text-muted">
          {t("tagline")}
        </span>
      </Container>
    </footer>
  );
}
