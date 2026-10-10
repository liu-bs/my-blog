import type { Metadata } from "next";
import { texts } from "@/texts";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function generateMetadata(): Metadata {
  return {
    title: `${texts.auth.registerTitle} · ${texts.meta.siteTitle}`,
    description: texts.auth.registerSubtitle,
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
