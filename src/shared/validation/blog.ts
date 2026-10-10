import { z } from "zod/mini";
import { optionalImageUrlSchema, trimmedNonEmptyString } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

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

export const postUpdateSchema = z.partial(postCreateSchema);

export type PostFormField = "title" | "content" | "category" | "summary" | "coverImage";
