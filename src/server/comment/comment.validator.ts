import "server-only";

import { createParser } from "@server/common/zod";
import { createCommentSchema } from "@/shared/validation/comment";
import type { CreateCommentDto } from "@shared";

export const parseCreateCommentBody = createParser<CreateCommentDto>(
  createCommentSchema,
  "Comment validation failed",
);
