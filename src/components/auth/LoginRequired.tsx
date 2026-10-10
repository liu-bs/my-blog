"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { texts } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { buildLoginRedirect } from "@/lib/url";

interface LoginRequiredProps {
  icon: ReactNode;

  description: string;
}

export function LoginRequired({ icon, description }: LoginRequiredProps) {
  const pathname = usePathname() || "/";
  return (
    <Container className="page-section">
      <EmptyState
        icon={icon}
        title={texts.common.loginRequired}
        description={description}
        action={<Button href={buildLoginRedirect(pathname)}>{texts.common.goLogin}</Button>}
      />
    </Container>
  );
}
