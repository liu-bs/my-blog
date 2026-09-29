/**
 * @file comment.ts
 * @description 评论领域的校验 schema。评论正文只有一个字段，长度上限是唯一的实质约束。
 */
import { z } from "zod/mini";
import { trimmedNonEmptyString } from "./builders";

/**
 * 评论正文最大长度
 * @description 与数据库字段容量对齐，同时限制单条评论体积防止刷屏
 */
export const COMMENT_MAX_LENGTH = 2000;

/**
 * 发表 / 更新评论入参校验
 * @description 仅有 content 一个字段：先 trim 再校验非空，长度上限见 {@link COMMENT_MAX_LENGTH}；
 *              违反时带 rule = "nonBlank"，前端可替换为本地化提示
 */
export const createCommentSchema = z.object({
  content: trimmedNonEmptyString("评论内容", COMMENT_MAX_LENGTH),
});

/**
 * 评论表单字段名
 * @description 供前端表单泛型约束使用，保证字段名与 schema 一致
 */
export type CommentField = "content";
