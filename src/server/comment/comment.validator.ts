import "server-only";

/**
 * @file 评论域参数校验器
 * @description 用 createParser 包装 @/shared/validation/comment 的 zod-mini schema，
 * 供 comment.controller 的发表/编辑 Action 共用；内容非空等字段规则由 schema 定义，失败抛 ValidationError（400）。
 */
import { createParser } from "@server/common/zod";
import { createCommentSchema } from "@/shared/validation/comment";
import type { CreateCommentDto } from "@shared";

/** 评论请求体解析器（发表与编辑复用同一 schema） */
export const parseCreateCommentBody = createParser<CreateCommentDto>(
  createCommentSchema,
  "Comment validation failed",
);
