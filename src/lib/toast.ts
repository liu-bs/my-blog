"use client";

import feedback from "@/texts/feedback";
import { formatTemplate } from "@/texts/format";
import { entityLabel, toErrorMessage, type EntityKey } from "@/lib/error-message";

type SonnerToast = (typeof import("sonner"))["toast"];

let sonnerPromise: Promise<SonnerToast> | null = null;

function sonner(): Promise<SonnerToast> {
  sonnerPromise ??= import("sonner").then((m) => m.toast);
  return sonnerPromise;
}

export const notify = {
  created(entity: EntityKey): void {
    const message = formatTemplate(feedback.create.success, { entity: entityLabel(entity) });
    void sonner().then((toast) => toast.success(message));
  },

  updated(entity: EntityKey): void {
    const message = formatTemplate(feedback.update.success, { entity: entityLabel(entity) });
    void sonner().then((toast) => toast.success(message));
  },

  deleted(entity: EntityKey): void {
    const message = formatTemplate(feedback.delete.success, { entity: entityLabel(entity) });
    void sonner().then((toast) => toast.success(message));
  },

  error(err: unknown, fallback?: string): void {
    const message = toErrorMessage(err, fallback);
    void sonner().then((toast) => toast.error(message));
  },

  success(message: string): void {
    void sonner().then((toast) => toast.success(message));
  },

  fail(message: string): void {
    void sonner().then((toast) => toast.error(message));
  },

  info(message: string): void {
    void sonner().then((toast) => toast.info(message));
  },
};
