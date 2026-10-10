"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginRequired } from "@/components/auth/LoginRequired";
import { UserCircle } from "lucide-react";
import { messages } from "@/texts";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <LoginRequired
        icon={<UserCircle size={20} strokeWidth={2.5} />}
        description={messages.errors.dashboardLoginDesc}
      />
    );
  }

  return <>{children}</>;
}
