import type { Metadata } from "next";
import auth from "@/texts/auth";
import meta from "@/texts/meta";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function generateMetadata(): Metadata {
  return {
    title: `${auth.registerTitle} · ${meta.siteTitle}`,
    description: auth.registerSubtitle,
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
