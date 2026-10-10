"use client";

import { Search } from "lucide-react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PostsError() {
  return (
    <Container className="page-section">

      <div className="animate-fade-in">
        <EmptyState
          icon={<Search size={20} strokeWidth={2.5} />}
          title={messages.errors.postsErrorTitle}
          description={messages.errors.postsErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {messages.errors.reload}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
