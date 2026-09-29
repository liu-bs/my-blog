/**
 * @file primitives.ts
 * @description 校验层的基础原语：图片 URL 安全判断、字段级错误常量、zod issue 格式化。
 *              被 auth / blog 等各领域 schema 与前端表单回填逻辑共同复用。
 */
import type { z } from "zod/mini";
import type { ValidationErrorDetail, ValidationRule } from "../types/ui";

/**
 * 图片链接不合法时的统一提示文案
 * @description 与 refine 的 params.rule = "imageUrl" 配合使用：作为服务端 message 兜底，
 *              前端命中 rule 后会用本地化文案覆盖它
 */
export const IMAGE_URL_INVALID_MESSAGE = "请填写以 https 开头的图片链接，或以 / 开头的站内路径";

/**
 * 判断图片地址是否允许使用
 * @description 只放行两类来源，防止被塞入 javascript: 伪协议或 // 开头的协议相对地址造成 XSS / 外链劫持：
 *              1）以单个 `/` 开头的站内绝对路径；
 *              2）解析后协议为 https 的绝对 URL。
 * @param src 待校验的图片地址，允许首尾空白
 * @returns 允许使用返回 true
 */
export function isSafeImageUrl(src: string): boolean {
  const value = src.trim();
  // 以 "/" 开头视为站内路径，但排除 "//" 开头的协议相对地址
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 把 zod 校验失败产生的 issue 列表转成前端可消费的字段级错误
 * @description 从 issue 中抽取边界值（minimum / maximum）与自定义规则标记（params.rule），
 *              使前端能在不解析文案的前提下生成「不少于 N 个字符」这类本地化提示
 * @param issues zod 的 issue 数组，通常来自 error.issues
 * @returns 每条 issue 对应的字段路径、默认文案、code、规则标记与数值边界
 */
export function formatZodIssues(issues: z.core.$ZodIssue[]): ValidationErrorDetail[] {
  return issues.map((issue) => {
    const detail: ValidationErrorDetail = {
      /** 多级 path 用 "." 连成可读的字段路径 */
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    };

    const extra = issue as { minimum?: unknown; maximum?: unknown; params?: unknown };
    const min = typeof extra.minimum === "number" ? extra.minimum : undefined;
    const max = typeof extra.maximum === "number" ? extra.maximum : undefined;
    // 仅当确实存在数值边界时才附带 params，避免给前端多余的 undefined 字段
    if (min !== undefined || max !== undefined) {
      detail.params = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    }

    // refine 显式写入的语义化规则标记，命中后前端改用本地化文案
    const rule = (extra.params as { rule?: unknown } | undefined)?.rule;
    if (typeof rule === "string") detail.rule = rule as ValidationRule;
    return detail;
  });
}
