/**
 * @file zod.ts
 * @description 服务端请求体校验的共用工厂：把 zod-mini schema 包装成「解析失败即抛
 * ValidationError」的解析函数，统一各 domain validator 的失败行为与错误明细格式。
 * 业务场景：auth/blog/comment 的 *.validator.ts 用它产出 parseXxx 函数，供 Server Action
 * 与 REST 路由解析入参。
 * 使用限制：只接受 zod/mini 的 ZodMiniType（标准 zod 的 ZodType 不适用）；抛出的错误由
 * runAction / defineRoute 兜底转成 400 响应，调用方无需自行 try/catch。
 */
import type { z } from "zod/mini";
import { ValidationError } from "@server/common/errors";
import { formatZodIssues } from "@shared";

/**
 * 由 schema 生成请求体解析函数
 * @param schema zod-mini schema，决定解析结果类型与校验规则
 * @param errorLabel 校验失败时写入 ValidationError 的 message，同时作为日志/表单提示文案
 * @returns 解析函数：入参为任意未知值（通常是请求 body），校验通过返回已归一化的强类型数据
 * @throws ValidationError（HTTP 400）携带 formatZodIssues 转换出的字段级明细，供前端表单标红
 * @example
 * const parseCreatePostBody = createParser(createPostSchema, "Invalid post payload");
 * const dto = parseCreatePostBody(body); // 类型自动收窄为 CreatePostDto
 * @warning 失败路径依赖抛出而非返回错误对象，因此不要用在需要「收集多个 schema 结果」的场景；
 * PATCH 类语义需保留字段存在性时也应绕开本工厂，直接用 safeParse
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
