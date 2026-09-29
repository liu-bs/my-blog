/**
 * @file (dashboard)/settings/page.tsx
 * @description 账号设置页（Server Component，受保护）。服务端校验登录态后渲染页面头与客户端设置表单；
 * 表单本身不预取任何用户数据，所需资料由 SettingsForm 在客户端自行获取。
 */
import { Container } from "@/components/ui/Container";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { PageHeader } from "@/components/layouts/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

/**
 * 账号设置页
 * @description requireUserOrRedirect 负责真正的登录校验（无会话则带 redirect 回跳参数跳到登录页）。
 * 返回值（当前用户）在此页未被使用——资料由客户端表单自行拉取，故不进行接收。
 * @param params 动态路由参数，含 locale
 * @returns 设置页 JSX
 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);

  await requireUserOrRedirect(locale, `/${locale}/settings`);

  const t = await getTranslations("settings");
  return (
    <Container className="page-section">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm />
    </Container>
  );
}
