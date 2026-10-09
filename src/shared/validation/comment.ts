/**
 * @file comment.ts
 * @description 评论创建的 zod（mini）校验 schema。
 * 服务端由 server/comment/comment.validator.ts 包装为 parseCreateCommentBody（Server Action 与
 * api/posts/[id]/comments REST 路由共用），客户端评论区 CommentsSection 同用该 schema 前置校验。
 */

import { z } from "zod/mini";
import { trimmedNonEmptyString } from "./builders";

/** 评论正文最大长度，前后端展示与校验统一引用 */
export const COMMENT_MAX_LENGTH = 2000;

/** 发表评论校验：正文 trim 后非空且不超过 COMMENT_MAX_LENGTH */
export const createCommentSchema = z.object({
  /** 评论内容，1-2000 字符且不能只含空白 */
  content: trimmedNonEmptyString("评论内容", COMMENT_MAX_LENGTH),
});

/** 评论区表单可出现字段级错误的字段名（CommentsSection 的 FieldErrors 键） */
export type CommentField = "content";
