import type { Metadata } from "next";
import { messages } from "@/texts";
import { LoginForm } from "@/components/auth/LoginForm";

export function generateMetadata(): Metadata {
  return {
    title: `${messages.auth.loginTitle} · ${messages.meta.siteTitle}`,
    description: messages.auth.loginSubtitle,
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
