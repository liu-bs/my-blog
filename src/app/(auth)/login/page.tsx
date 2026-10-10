import type { Metadata } from "next";
import { texts } from "@/texts";
import { LoginForm } from "@/components/auth/LoginForm";

export function generateMetadata(): Metadata {
  return {
    title: `${texts.auth.loginTitle} · ${texts.meta.siteTitle}`,
    description: texts.auth.loginSubtitle,
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
