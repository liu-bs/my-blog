import type { ValidationRule } from "@shared";
import { formatTemplate, texts } from "@/texts";

export type EntityKey = keyof (typeof texts)["feedback"]["entity"];

export function entityLabel(name: EntityKey): string {
  return texts.feedback.entity[name];
}

function fieldLabel(name: string): string | undefined {
  const dict: Record<string, string> = texts.feedback.field;
  return dict[name];
}

const HTTP_STATUS_TEXT_KEY: Record<number, { key: string }> = {
  0: { key: "networkError" },
  401: { key: "sessionExpired" },
  403: { key: "forbidden" },
  404: { key: "contentGone" },
  408: { key: "timeout" },
  429: { key: "rateLimited" },
  500: { key: "unknownError" },
};

function getHttpStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

export function toErrorMessage(err: unknown, fallback?: string): string {
  const status = getHttpStatus(err);
  if (status === null) return fallback ?? texts.feedback.common.unknownError;
  const mapped = HTTP_STATUS_TEXT_KEY[status];

  if (mapped) {
    const dict: Record<string, string> = texts.feedback.common;
    return formatTemplate(dict[mapped.key] ?? mapped.key);
  }

  if (status < 500) return texts.feedback.common.actionFailed;
  return texts.feedback.common.unknownError;
}

export function toValidationError(detail: {
  path: string;
  code?: string;
  rule?: ValidationRule;
  params?: { min?: number; max?: number };
}): string {
  const label = fieldLabel(detail.path);
  const form = texts.feedback.form;
  const invalid = form.invalidField;

  if (detail.rule) {
    switch (detail.rule) {
      case "imageUrl":
        return form.imageUrl;
      case "nonBlank":
        return label ? formatTemplate(form.requiredInput, { field: label }) : invalid;
      case "passwordMismatch":
        return form.sameAsCurrent;
    }
  }

  switch (detail.code) {
    case "too_small": {
      if (!label) return invalid;

      const min = detail.params?.min ?? 1;
      return min <= 1
        ? formatTemplate(form.requiredInput, { field: label })
        : formatTemplate(form.tooShort, { field: label, min });
    }
    case "too_big": {
      const max = detail.params?.max;
      if (!label || max === undefined) return invalid;
      return formatTemplate(form.tooLong, { field: label, max });
    }
    default:
      return label ? formatTemplate(form.format, { field: label }) : invalid;
  }
}
