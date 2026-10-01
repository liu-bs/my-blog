import { Container } from "@/components/ui/Container";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { PageHeader } from "@/components/layouts/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

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
