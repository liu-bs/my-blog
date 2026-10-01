/**
 * @file page.tsx
 * @description 账号设置页（Server Component）：服务端经 requireUserOrRedirect 二次校验登录态
 *              （未登录重定向登录页），渲染设置表单客户端组件
 */
import { Container } from "@/components/ui/Container";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { PageHeader } from "@/components/layouts/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

/**
 * 设置页组件
 * @param params 路由参数，含 locale
 * @returns 页头 + 设置表单；未登录被重定向到登录页
 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);

  // 服务端登录校验：未登录重定向到登录页并回跳当前页
  await requireUserOrRedirect(locale, `/${locale}/settings`);

  const t = await getTranslations("settings");
  return (
    <Container className="page-section">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm />
    </Container>
  );
}
