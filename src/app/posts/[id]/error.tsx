"use client";

import { AlertCircle } from "lucide-react";
import errors from "@/texts/errors";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PostDetailError() {
  return (
    <Container className="page-section">
      <div className="animate-fade-in">
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={2.5} />}
          title={errors.postErrorTitle}
          description={errors.postErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {errors.backToList}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
