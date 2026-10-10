import "server-only";

import type { z } from "zod/mini";
import { createParser } from "@server/common/zod";
import { postCreateSchema, postUpdateSchema } from "@/shared/validation/blog";
import type { CreatePostDto, UpdatePostDto } from "@shared";

export const parseCreatePostBody = createParser<CreatePostDto>(
  postCreateSchema as unknown as z.ZodMiniType<CreatePostDto>,
  "Post validation failed",
);

export const parseUpdatePostBody = createParser<UpdatePostDto>(
  postUpdateSchema as unknown as z.ZodMiniType<UpdatePostDto>,
  "Post validation failed",
);
