/**
 * @file zod.ts
 * @description zod 校验器的服务端适配层：把 shared 层定义的 schema 包装成「失败即抛 ValidationError」的解析函数，
 * 让调用方不必到处写 safeParse 的 if 分支。使用 zod/mini 以减小打包体积。
 * 使用限制：schema 必须来自 @shared，保证前后端校验规则同源；本文件不产出 HTTP 响应，转换由上层统一处理。
 */
import type { z } from "zod/mini";
import { ValidationError } from "@server/common/errors";
import { formatZodIssues } from "@shared";

/**
 * 用 schema 生成一个「解析失败就抛错」的函数
 * @param schema 校验规则
 * @param errorLabel 校验失败时的错误文案，用于区分是哪个接口的入参出错
 * @returns 解析函数，入参任意，成功返回收窄后的类型
 * @throws ValidationError 校验失败，details 为 formatZodIssues 归一化后的逐字段错误
 * @description 采用抛错而非返回 Result，是为了配合 sendError / runAction 的集中异常处理，避免每处调用都判空
 */
export function createParser<T>(
  schema: z.ZodMiniType<T>,
  errorLabel: string,
): (body: unknown) => T {
  return (body: unknown): T => {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(errorLabel, formatZodIssues(result.error.issues));
    }
    return result.data;
  };
}
