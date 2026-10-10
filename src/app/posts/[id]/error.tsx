"use client";

import { AlertCircle } from "lucide-react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PostDetailError() {
  return (
    <Container className="page-section">

      <div className="animate-fade-in">
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={2.5} />}
          title={messages.errors.postErrorTitle}
          description={messages.errors.postErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {messages.errors.backToList}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
