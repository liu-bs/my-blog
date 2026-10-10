import type { Metadata } from "next";
import { messages } from "@/texts";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function generateMetadata(): Metadata {
  return {
    title: `${messages.auth.registerTitle} · ${messages.meta.siteTitle}`,
    description: messages.auth.registerSubtitle,
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
