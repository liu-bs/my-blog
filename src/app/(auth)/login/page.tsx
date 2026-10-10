import type { Metadata } from "next";
import auth from "@/texts/auth";
import meta from "@/texts/meta";
import { LoginForm } from "@/components/auth/LoginForm";

export function generateMetadata(): Metadata {
  return {
    title: `${auth.loginTitle} · ${meta.siteTitle}`,
    description: auth.loginSubtitle,
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
