/**
 * @file comment.ts
 * @description 评论发表的 zod/mini 校验 schema：仅一个正文字段，复用通用非空字符串规则
 */
import { z } from "zod/mini";
import { trimmedNonEmptyString } from "./builders";

/** 评论内容最大长度：2000 字符 */
export const COMMENT_MAX_LENGTH = 2000;

/**
 * 发表评论校验 schema
 */
export const createCommentSchema = z.object({
  /** 评论正文，去除首尾空白后非空且不超过 2000 字符 */
  content: trimmedNonEmptyString("评论内容", COMMENT_MAX_LENGTH),
});

/** 评论表单字段名集合 */
export type CommentField = "content";
