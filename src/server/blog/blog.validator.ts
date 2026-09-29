/**
 * @file blog.validator.ts
 * @description 文章领域的入参校验层：把共享层的 zod schema 包装成「校验失败即抛 ValidationError」的解析器，
 * 供 controller 在调用 service 之前统一校验创建 / 更新文章的请求体
 */
import "server-only";
import type { z } from "zod/mini";
import { createParser } from "@server/common/zod";
import { postCreateSchema, postUpdateSchema } from "@/shared/validation/blog";
import type { CreatePostDto, UpdatePostDto } from "@shared";

/**
 * 创建文章的请求体解析器
 * @description 基于共享 schema `postCreateSchema` 校验：title / content / category 必填且有长度上限，
 * tags 兼容逗号分隔字符串或数组，coverImage 必须是 https 链接或站内 / 路径，isDraft 决定是否直接落库为草稿
 * @param body 未经校验的原始请求体，通常为 Server Action 的入参
 * @returns 校验通过并按 schema 归一化后的 {@link CreatePostDto}
 * @throws ValidationError 校验失败时抛出，携带逐字段的错误明细
 */
export const parseCreatePostBody = createParser<CreatePostDto>(
  postCreateSchema as unknown as z.ZodMiniType<CreatePostDto>,
  "Post validation failed",
);

/**
 * 更新文章的请求体解析器
 * @description 复用创建 schema 的 partial 版本，因此所有字段都可选，只校验实际传入的字段；
 * 未传入的字段由 service 保留数据库中的原值，支持「只改标题」「只切换草稿状态」等局部更新
 * @param body 未经校验的原始请求体
 * @returns 校验通过后的 {@link UpdatePostDto}，字段均为可选
 * @throws ValidationError 校验失败时抛出
 */
export const parseUpdatePostBody = createParser<UpdatePostDto>(
  postUpdateSchema as unknown as z.ZodMiniType<UpdatePostDto>,
  "Post validation failed",
);
