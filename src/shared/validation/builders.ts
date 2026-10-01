import { z } from "zod/mini";
import { isSafeImageUrl } from "./primitives";

export function optionalImageUrlSchema(field: string, max: number, message: string) {
  return z.optional(
    z.string().check(
      z.maxLength(max, `${field}不能超过 ${max} 个字符`),
      z.refine((v) => v === "" || isSafeImageUrl(v), { message, params: { rule: "imageUrl" } }),
    ),
  );
}

export function trimmedNonEmptyString(field: string, max: number) {
  return z
    .pipe(
      z
        .string()
        .check(
          z.minLength(1, `${field}不能为空`),
          z.maxLength(max, `${field}不能超过 ${max} 个字符`),
        ),
      z.transform((v) => v.trim()),
    )
    .check(
      z.refine((v) => v.length > 0, {
        message: `${field}不能只包含空白字符`,
        params: { rule: "nonBlank" },
      }),
    );
}
