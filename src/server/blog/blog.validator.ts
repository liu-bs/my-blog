import "server-only";

/**
 * @file 博客域参数校验器
 * @description 用 createParser 包装 @/shared/validation/blog 的 zod-mini schema，
 * 供 blog.controller 的创建/更新 Action 使用；失败统一抛 ValidationError（400 + issue 明细）。
 */
import type { z } from "zod/mini";
import { createParser } from "@server/common/zod";
import { postCreateSchema, postUpdateSchema } from "@/shared/validation/blog";
import type { CreatePostDto, UpdatePostDto } from "@shared";

/** 创建文章请求体解析器，断言输出形状为 CreatePostDto */
export const parseCreatePostBody = createParser<CreatePostDto>(
  postCreateSchema as unknown as z.ZodMiniType<CreatePostDto>,
  "Post validation failed",
);

/** 更新文章请求体解析器（PATCH 语义，字段均可选） */
export const parseUpdatePostBody = createParser<UpdatePostDto>(
  postUpdateSchema as unknown as z.ZodMiniType<UpdatePostDto>,
  "Post validation failed",
);
