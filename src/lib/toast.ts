"use client";

import { toast as sonner } from "sonner";
import { currentMsgLocale, entityName, errorToMsg, msg, type EntityKey } from "@/lib/message";

export const notify = {

  created(entity: EntityKey): void {
    sonner.success(msg("create", "success", { entity: entityName(entity) }));
  },

  updated(entity: EntityKey): void {
    sonner.success(msg("update", "success", { entity: entityName(entity) }));
  },

  deleted(entity: EntityKey): void {
    sonner.success(msg("delete", "success", { entity: entityName(entity) }));
  },

  error(err: unknown, fallback?: string): void {
    sonner.error(errorToMsg(err, currentMsgLocale(), fallback));
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
