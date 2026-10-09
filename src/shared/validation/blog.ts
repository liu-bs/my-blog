/**
 * @file blog.ts
 * @description 文章创建/更新的 zod（mini）校验 schema。
 * 服务端由 server/blog/blog.validator.ts 包装为 parseCreatePostBody/parseUpdatePostBody，
 * 客户端写作页 WriteEditor 导入同 schema 做提交前校验。
 */

import { z } from "zod/mini";
import { optionalImageUrlSchema, trimmedNonEmptyString } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/** 新建文章校验：标题/正文/分类必填非空白，摘要、标签、封面可选 */
export const postCreateSchema = z.object({
  /** 文章标题，trim 后非空，最长 200 */
  title: trimmedNonEmptyString("标题", 200),

  /** 摘要，可选，最长 500；留空时服务端从正文自动截取 */
  summary: z.optional(z.string().check(z.maxLength(500, "摘要不能超过 500 个字符"))),

  /** Markdown 正文，trim 后非空，最长 200000 */
  content: trimmedNonEmptyString("正文", 200000),

  /** 分类名，trim 后非空，最长 50 */
  category: trimmedNonEmptyString("分类", 50),

  /** 标签，可选：逗号分隔字符串（≤300）或字符串数组（每项 ≤30）两种入站形态 */
  tags: z.optional(
    z.union([z.string().check(z.maxLength(300)), z.array(z.string().check(z.maxLength(30)))]),
  ),

  /** 是否存为草稿，必填布尔值 */
  isDraft: z.boolean("isDraft 必须是布尔值"),

  /** 是否置顶，可选布尔 */
  pinned: z.optional(z.boolean()),

  /** 封面图链接，可选，最长 2000，需 https 或站内 / 路径（isSafeImageUrl） */
  coverImage: optionalImageUrlSchema("封面图链接", 2000, IMAGE_URL_INVALID_MESSAGE),
});

/** 更新文章校验：postCreateSchema 全字段置为可选（PATCH 语义） */
export const postUpdateSchema = z.partial(postCreateSchema);

/** 写作编辑器可出现字段级错误的字段名（WriteEditor 的 FieldErrors 键） */
export type PostFormField = "title" | "content" | "category" | "summary" | "coverImage";
