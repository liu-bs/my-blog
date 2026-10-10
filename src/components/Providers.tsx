"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/AuthProvider";
import type { ProvidersProps } from "@shared";

const Toaster = dynamic(() => import("@/components/ui/Sonner").then((m) => m.Toaster), {
  ssr: false,
});

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        {mounted && <Toaster />}
      </AuthProvider>
    </ThemeProvider>
  );
}
