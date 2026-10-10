import { Container } from "@/components/ui/Container";
import { messages } from "@/texts";
import { PageHeader } from "@/components/layouts/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export default async function SettingsPage() {

  await requireUserOrRedirect("/settings");

  return (
    <Container className="page-section">

      <PageHeader title={messages.settings.title} subtitle={messages.settings.subtitle} />

      <SettingsForm />
    </Container>
  );
}
