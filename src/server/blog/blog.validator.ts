/**
 * @file blog.validator.ts
 * @description 文章创建/更新请求体校验器。基于共享 zod schema 创建解析器，
 * schema 与 DTO 结构存在差异时做类型断言桥接，校验失败抛出带字段明细的 ValidationError。
 */
import "server-only";
import type { z } from "zod/mini";
import { createParser } from "@server/common/zod";
import { postCreateSchema, postUpdateSchema } from "@/shared/validation/blog";
import type { CreatePostDto, UpdatePostDto } from "@shared";

/** 创建文章请求体解析器，校验失败抛 ValidationError */
export const parseCreatePostBody = createParser<CreatePostDto>(
  postCreateSchema as unknown as z.ZodMiniType<CreatePostDto>,
  "Post validation failed",
);

/** 更新文章请求体解析器（部分字段可选），校验失败抛 ValidationError */
export const parseUpdatePostBody = createParser<UpdatePostDto>(
  postUpdateSchema as unknown as z.ZodMiniType<UpdatePostDto>,
  "Post validation failed",
);
