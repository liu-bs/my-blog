"use client";

import { useEffect, useState } from "react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { ErrorBoundaryProps } from "@shared";

export default function Error({ error, retry }: ErrorBoundaryProps) {

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copyError = () => {
    const text = `${error.name}: ${error.message}\n${error.stack || ""}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);

        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <Container className="page-section">

      <div className="flex min-h-[50vh] animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="mb-5 display-serif text-(length:--type-3xl) leading-tight font-bold text-heading">
          {messages.errors.errorTitle}
        </h1>
        <p className="mb-10 max-w-100 text-(length:--type-base) leading-relaxed text-muted">
          {messages.errors.errorDesc}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={retry}>{messages.errors.reload}</Button>
          <Button variant="ghost" href="/">
            {messages.errors.goHome}
          </Button>
          <Button variant="ghost" onClick={copyError}>
            {copied ? messages.errors.copied : messages.errors.copyError}
          </Button>
        </div>
      </div>
    </Container>
  );
}
