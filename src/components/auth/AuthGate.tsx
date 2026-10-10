"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { UserCircle } from "lucide-react";
import errors from "@/texts/errors";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={errors.dashboardLoginDesc}
      />
    );
  }

  return <>{children}</>;
}
