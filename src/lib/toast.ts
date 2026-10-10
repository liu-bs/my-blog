"use client";

import { toast as sonner } from "sonner";
import { formatTemplate, texts } from "@/texts";
import { entityLabel, toErrorMessage, type EntityKey } from "@/lib/error-message";

export const notify = {
  created(entity: EntityKey): void {
    sonner.success(formatTemplate(texts.feedback.create.success, { entity: entityLabel(entity) }));
  },

  updated(entity: EntityKey): void {
    sonner.success(formatTemplate(texts.feedback.update.success, { entity: entityLabel(entity) }));
  },

  deleted(entity: EntityKey): void {
    sonner.success(formatTemplate(texts.feedback.delete.success, { entity: entityLabel(entity) }));
  },

  error(err: unknown, fallback?: string): void {
    sonner.error(toErrorMessage(err, fallback));
  },

  success(text: string): void {
    sonner.success(text);
  },

  fail(text: string): void {
    sonner.error(text);
  },

  info(text: string): void {
    sonner.info(text);
  },
};
