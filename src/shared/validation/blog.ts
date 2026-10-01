/**
 * @file blog.ts
 * @description 文章创建/更新的 zod/mini 校验 schema：标题、正文、分类、标签、封面图等字段规则，
 *              更新 schema 由创建 schema 派生为全可选，写入口（server action）必须先过这里的校验
 */
import { z } from "zod/mini";
import { optionalImageUrlSchema, trimmedNonEmptyString } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/**
 * 文章创建校验 schema
 */
export const postCreateSchema = z.object({
  /** 标题，去除首尾空白后非空且不超过 200 字符 */
  title: trimmedNonEmptyString("标题", 200),

  /** 摘要，可选，最长 500 字符，留空由服务端自动截取正文 */
  summary: z.optional(z.string().check(z.maxLength(500, "摘要不能超过 500 个字符"))),

  /** 正文（Markdown），去除首尾空白后非空且不超过 200000 字符 */
  content: trimmedNonEmptyString("正文", 200000),

  /** 分类名，去除首尾空白后非空且不超过 50 字符 */
  category: trimmedNonEmptyString("分类", 50),

  /** 标签，可选：接受单个字符串（≤300 字符，服务端拆分）或字符串数组（每项 ≤30 字符） */
  tags: z.optional(
    z.union([z.string().check(z.maxLength(300)), z.array(z.string().check(z.maxLength(30)))]),
  ),

  /** 是否草稿，必填布尔值 */
  isDraft: z.boolean("isDraft 必须是布尔值"),

  /** 是否置顶，可选布尔值，缺省视为不置顶 */
  pinned: z.optional(z.boolean()),

  /** 封面图 URL，可选，最长 2000 字符，必须为空串或安全图片地址（https/站内路径） */
  coverImage: optionalImageUrlSchema("封面图链接", 2000, IMAGE_URL_INVALID_MESSAGE),
});

/** 文章更新校验 schema：由创建 schema 派生，全部字段变为可选，支持部分更新 */
export const postUpdateSchema = z.partial(postCreateSchema);

/** 文章表单字段名集合（客户端表单逐字段报错用） */
export type PostFormField = "title" | "content" | "category" | "summary" | "coverImage";
