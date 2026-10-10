import { Container } from "@/components/ui/Container";
import settings from "@/texts/settings";
import { PageHeader } from "@/components/shell/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.guard";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export default async function SettingsPage() {
  await requireUserOrRedirect("/settings");

  return (
    <Container className="page-section">
      <PageHeader title={settings.title} subtitle={settings.subtitle} />

      <SettingsForm />
    </Container>
  );
}
