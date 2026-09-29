/**
 * @file WriteCta.tsx
 * @description 首页 Hero 区的「开始写作」入口，渲染为跳转 /write 的次级按钮；本身不做登录态判断，交由目标页与中间件在跳转后处理权限
 */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * WriteCta 写作入口按钮
 * @description 传入 href 使 Button 走链接分支，由 i18n 导航自动补语言前缀；
 * 文案取自 home.startWriting，随当前语言切换
 * @returns 指向 /write 的链接形态按钮
 */
export function WriteCta() {
  const t = useTranslations("home");

  return (
    <Button href="/write" variant="outline" size="lg">
      {t("startWriting")}
    </Button>
  );
}
