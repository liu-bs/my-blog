/**
 * @file builders.ts
 * @description zod schema 构造器（工厂函数）。把「字段中文名 + 长度上限」参数化，
 *              统一生成带参的错误文案与语义化规则标记，避免各领域 schema 重复书写 message。
 *              返回的是 zod schema 片段，供上层组合进 z.object。
 */
import { z } from "zod/mini";
import { isSafeImageUrl } from "./primitives";

/**
 * 构造「可选的图片 URL」schema
 * @description 空字符串视为「未填写」直接放行（前端清空输入框即提交空串），
 *              非空时必须是安全的图片地址，否则报 `message` 并携带 rule = "imageUrl" 供前端替换为本地化文案
 * @param field 字段中文名，用于拼接超长提示
 * @param max 允许的最大字符数，防止超长外链撑爆存储
 * @param message 图片地址不安全时的提示文案，通常传 IMAGE_URL_INVALID_MESSAGE
 * @returns 可选的图片 URL 校验 schema
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
 * 构造「去除首尾空白后非空」的字符串 schema
 * @description 先按长度校验、再 trim，最后追加一次非空 refine，双重保证：
 *              既能拦住空串，也能拦住「全是空格」这类看似有内容实则无意义的输入。
 *              长度上限作用于 trim 前的原值，防止用大段空白绕过上限。
 * @param field 字段中文名，用于拼接各条提示
 * @param max 允许的最大字符数
 * @returns 非空且已 trim 的字符串校验 schema
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
