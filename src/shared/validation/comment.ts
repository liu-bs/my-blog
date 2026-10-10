import { z } from "zod/mini";
import { trimmedNonEmptyString } from "./builders";

export const COMMENT_MAX_LENGTH = 2000;

export const createCommentSchema = z.object({
  content: trimmedNonEmptyString("评论内容", COMMENT_MAX_LENGTH),
});

export type CommentField = "content";
