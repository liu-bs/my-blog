import { Container } from "@/components/ui/Container";
import { texts } from "@/texts";
import { PageHeader } from "@/components/shell/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.guard";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export default async function SettingsPage() {
  await requireUserOrRedirect("/settings");

  return (
    <Container className="page-section">
      <PageHeader title={texts.settings.title} subtitle={texts.settings.subtitle} />

      <SettingsForm />
    </Container>
  );
}
