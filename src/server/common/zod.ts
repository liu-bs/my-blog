/**
 * @file zod.ts
 * @description zod 校验工厂。将 zod schema 包装为统一的解析函数，校验失败抛出 ValidationError 并携带字段级错误明细。
 */
import type { z } from "zod/mini";
import { ValidationError } from "@server/common/errors";
import { formatZodIssues } from "@shared";

/**
 * 创建基于 zod schema 的请求体解析器
 * @param schema zod mini schema，用于校验并收窄入参类型
 * @param errorLabel 校验失败时的错误文案前缀
 * @returns 解析函数：入参为待校验的未知数据，返回校验通过后的强类型数据
 * @throws 校验失败时抛出 ValidationError，details 为格式化后的字段错误列表
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
