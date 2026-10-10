import type { z } from "zod/mini";
import type { ValidationErrorDetail, ValidationRule } from "../types/ui";

export const IMAGE_URL_INVALID_MESSAGE = "请填写以 https 开头的图片链接，或以 / 开头的站内路径";

export function parseNonNegativeInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function isSafeImageUrl(src: string): boolean {
  const value = src.trim();

  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function formatZodIssues(issues: z.core.$ZodIssue[]): ValidationErrorDetail[] {
  return issues.map((issue) => {
    const detail: ValidationErrorDetail = {
      path: issue.path.join("."),

      message: issue.message,

      code: issue.code,
    };

    const extra = issue as { minimum?: unknown; maximum?: unknown; params?: unknown };
    const min = typeof extra.minimum === "number" ? extra.minimum : undefined;
    const max = typeof extra.maximum === "number" ? extra.maximum : undefined;

    if (min !== undefined || max !== undefined) {
      detail.params = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    }

    const rule = (extra.params as { rule?: unknown } | undefined)?.rule;
    if (typeof rule === "string") detail.rule = rule as ValidationRule;
    return detail;
  });
}
