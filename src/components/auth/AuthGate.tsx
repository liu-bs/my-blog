"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { UserCircle } from "lucide-react";
import { texts } from "@/texts";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={texts.errors.dashboardLoginDesc}
      />
    );
  }

  return <>{children}</>;
}
