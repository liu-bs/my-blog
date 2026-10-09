/**
 * @file builders.ts
 * @description 跨领域复用的 zod（mini）字段 schema 工厂函数，供 auth/blog/comment 校验文件构造字段规则。
 */

import { z } from "zod/mini";
import { isSafeImageUrl } from "./primitives";

/**
 * 构造"可选图片 URL"字段 schema：空值/未填放行，填写则必须通过 isSafeImageUrl
 * @param field 字段中文名，用于拼装超长错误消息
 * @param max 最长字符数
 * @param message URL 不安全或格式不符时的错误消息
 * @returns zod schema：可选字符串，校验长度与图片 URL 规则（rule 标记为 imageUrl）
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
 * 构造"trim 后非空"字符串字段 schema
 * @param field 字段中文名，用于拼装错误消息
 * @param max 最长字符数
 * @returns zod schema：拒绝纯空白与超长输入（纯空白时 rule 标记为 nonBlank）
 * @warning minLength(1) 作用于 trim 前，全空格输入依赖后置 refine 拦截
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
