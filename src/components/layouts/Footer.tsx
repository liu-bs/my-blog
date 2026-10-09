/**
 * @file Footer.tsx
 * @description 全站页脚组件，展示版权信息（站点名取自 messages.nav.brand）与标语；移动端纵向居中排列
 */
import { formatTemplate, messages } from "@/texts";
import { Container } from "../ui/Container";

/** 页脚（无入参），文案全部来自 messages 多语言文本表 */
export function Footer() {
  return (
    /* 页脚外层：顶部分隔线 + 页面底色 */
    <footer className="border-t border-stroke bg-page py-10">
      {/* 内容行：左侧版权、右侧标语，复用 Container 约束宽度 */}
      <Container className="flex flex-wrap items-center justify-between gap-4 text-(length:--type-xs) leading-normal text-muted max-md:flex-col max-md:gap-3 max-md:text-center">
        {/* 版权信息，站点名注入模板占位符 */}
        <span className="inline-flex items-center font-medium tracking-[0.01em]">
          {formatTemplate(messages.footer.copyright, {
            site: messages.nav.brand,
          })}
        </span>

        {/* 站点标语 */}
        <span>{messages.footer.tagline}</span>
      </Container>
    </footer>
  );
}
