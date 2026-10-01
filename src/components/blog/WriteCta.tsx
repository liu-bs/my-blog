/**
 * @file WriteCta.tsx
 * @description 首页"开始写作"引导按钮，服务端组件，跳转 /write 写作页
 */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * WriteCta 写作入口按钮
 */
export function WriteCta() {
  const t = useTranslations("home");

  return (
    <Button href="/write" variant="outline" size="lg">
      {t("startWriting")}
    </Button>
  );
}
