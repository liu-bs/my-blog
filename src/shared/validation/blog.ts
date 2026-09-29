/**
 * @file blog.ts
 * @description 文章领域的校验 schema：创建 / 更新文章的入参规则，以及前端表单字段名类型。
 *              服务端 blog.validator 与前端 WriteEditor 共用 postCreateSchema，保证边界值两侧一致。
 */
import { z } from "zod/mini";
import { optionalImageUrlSchema, trimmedNonEmptyString } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/**
 * 创建文章入参校验
 * @description 各长度上限取值依据：
 *              - title ≤ 200：列表卡片与 SEO 标题的展示上限；
 *              - summary ≤ 500：摘要可省略，省略时由服务端从正文截取；
 *              - content ≤ 200000：约 20 万字符，容纳长篇技术文章，同时兜住异常大请求；
 *              - category ≤ 50：分类名为短标识，与侧边栏展示宽度匹配；
 *              - tags 兼容「逗号分隔字符串（整串 ≤300）」与「字符串数组（单个 ≤30）」两种形态，
 *                此处不限制标签个数，数量与去重由服务端归一化统一处理；
 *              - coverImage ≤ 2000：容忍带签名参数的长 CDN 链接。
 */
export const postCreateSchema = z.object({
  title: trimmedNonEmptyString("标题", 200),

  summary: z.optional(z.string().check(z.maxLength(500, "摘要不能超过 500 个字符"))),

  content: trimmedNonEmptyString("正文", 200000),

  category: trimmedNonEmptyString("分类", 50),

  tags: z.optional(
    z.union([z.string().check(z.maxLength(300)), z.array(z.string().check(z.maxLength(30)))]),
  ),

  isDraft: z.boolean("isDraft 必须是布尔值"),

  pinned: z.optional(z.boolean()),

  coverImage: optionalImageUrlSchema("封面图链接", 2000, IMAGE_URL_INVALID_MESSAGE),
});

/**
 * 更新文章入参校验
 * @description 在创建 schema 基础上全部置为可选，对应只提交变更字段的 PATCH 语义；
 *              约束条件与创建完全一致，避免更新时绕过长度校验
 */
export const postUpdateSchema = z.partial(postCreateSchema);

/**
 * 文章表单字段名
 * @description 仅列出前端写文章表单会做即时校验的字段
 */
export type PostFormField = "title" | "content" | "category" | "summary" | "coverImage";
