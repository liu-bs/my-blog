"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/Sonner";
import type { ProvidersProps } from "@shared";

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
