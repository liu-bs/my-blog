import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { LoginForm } from "@/components/auth/LoginForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  const [t, tMeta] = await Promise.all([getTranslations("auth"), getTranslations("meta")]);
  return {
    title: `${t("loginTitle")} · ${tMeta("siteTitle")}`,
    description: t("loginSubtitle"),
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
