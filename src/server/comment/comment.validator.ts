/**
 * @file comment.validator.ts
 * @description 评论入参校验器：把 createCommentSchema（shared 层，前后端共用）包装成服务端可调用的解析函数。
 * 校验失败统一抛出 ValidationError（HTTP 400），由上层 sendError / runAction 转成响应。
 * 使用限制：仅做结构与格式校验，正文的 HTML 清洗在 comment.service 中完成。
 */
import "server-only";
import { createParser } from "@server/common/zod";
import { createCommentSchema } from "@/shared/validation/comment";
import type { CreateCommentDto } from "@shared";

/**
 * 解析并校验发表 / 编辑评论的请求体
 * @description 编辑评论复用同一份 schema，因为两者对正文的要求完全一致
 * @throws ValidationError 校验失败，details 中携带逐字段错误信息
 */
export const parseCreateCommentBody = createParser<CreateCommentDto>(
  createCommentSchema,
  "Comment validation failed",
);
