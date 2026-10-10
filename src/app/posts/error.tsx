"use client";

import { Search } from "lucide-react";
import { texts } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PostsError() {
  return (
    <Container className="page-section">
      <div className="animate-fade-in">
        <EmptyState
          icon={<Search size={20} strokeWidth={2.5} />}
          title={texts.errors.postsErrorTitle}
          description={texts.errors.postsErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {texts.errors.reload}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
