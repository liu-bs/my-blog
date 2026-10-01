/**
 * @file builders.ts
 * @description 可复用的 zod/mini schema 构造器：图片 URL 与非空字符串两类通用字段的校验规则，
 *              供 auth/comment/blog 等业务 schema 组合使用，统一长度限制与错误文案格式
 */
import { z } from "zod/mini";
import { isSafeImageUrl } from "./primitives";

/**
 * 构造可选图片 URL 字段 schema
 * 规则：可缺省；传入时先限制最大长度，再要求为空串或通过 isSafeImageUrl 安全校验
 * （https 绝对地址或站内 / 路径），失败时附带 rule: "imageUrl" 供前端识别
 * @param field 字段中文名，用于错误文案
 * @param max 最大字符数
 * @param message 校验失败提示文案
 */
export function optionalImageUrlSchema(field: string, max: number, message: string) {
  return z.optional(
    z.string().check(
      z.maxLength(max, `${field}不能超过 ${max} 个字符`),
      z.refine((v) => v === "" || isSafeImageUrl(v), { message, params: { rule: "imageUrl" } }),
    ),
  );
}

/**
 * 构造去空格后的非空字符串字段 schema
 * 规则：非空（≥1 且 ≤max 字符）→ 去除首尾空白 → 校验剩余部分不能全是空白字符
 * @param field 字段中文名，用于错误文案
 * @param max 最大字符数
 */
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
