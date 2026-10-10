"use client";

import { Search } from "lucide-react";
import errors from "@/texts/errors";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PostsError() {
  return (
    <Container className="page-section">
      <div className="animate-fade-in">
        <EmptyState
          icon={<Search size={20} strokeWidth={2.5} />}
          title={errors.postsErrorTitle}
          description={errors.postsErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {errors.reload}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
