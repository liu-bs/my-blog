"use client";

import { toast as sonner } from "sonner";
import { formatTemplate, messages } from "@/texts";
import { entityName, errorToMsg, type EntityKey } from "@/lib/message";

export const notify = {

  created(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.create.success, { entity: entityName(entity) }),
    );
  },

  updated(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.update.success, { entity: entityName(entity) }),
    );
  },

  deleted(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.delete.success, { entity: entityName(entity) }),
    );
  },

  error(err: unknown, fallback?: string): void {
    sonner.error(errorToMsg(err, fallback));
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
