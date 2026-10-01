/**
 * @file comment.validator.ts
 * @description 评论创建请求体校验器，基于共享 zod schema，校验失败抛出带字段明细的 ValidationError。
 */
import "server-only";
import { createParser } from "@server/common/zod";
import { createCommentSchema } from "@/shared/validation/comment";
import type { CreateCommentDto } from "@shared";

/** 创建评论请求体解析器，校验失败抛 ValidationError */
export const parseCreateCommentBody = createParser<CreateCommentDto>(
  createCommentSchema,
  "Comment validation failed",
);
