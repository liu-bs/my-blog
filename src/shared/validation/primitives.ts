/**
 * @file primitives.ts
 * @description 校验层基础工具：图片 URL 安全判断、query 数字解析、zod issue 明细格式化。
 * 消费方：server/common/zod.ts 的 createParser、lib/formFeedback.ts（字段级错误映射）、
 * builders.ts（图片字段）、blog.service 封面校验、CoverField 组件、评论 REST 路由分页参数。
 */

import type { z } from "zod/mini";
import type { ValidationErrorDetail, ValidationRule } from "../types/ui";

/** 图片 URL 校验失败的标准提示，前后端（zod schema 与表单文案）共用同一措辞 */
export const IMAGE_URL_INVALID_MESSAGE = "请填写以 https 开头的图片链接，或以 / 开头的站内路径";

/**
 * 解析 URL query 中的非负整数参数
 * @param raw 原始字符串，可为 null
 * @returns 合法非负整数；缺省、NaN、负数等情况返回 undefined（由调用方使用默认值）
 */
export function parseNonNegativeInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * 判断图片地址是否安全可用（头像、封面图字段通用规则）
 * @param src 图片 URL 或站内路径
 * @returns 站内绝对路径（以单个 / 开头，排除协议相对路径 //）或 https 协议 URL 时为 true
 */
export function isSafeImageUrl(src: string): boolean {
  const value = src.trim();

  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 将 zod 校验 issue 列表归一化为前端可消费的 ValidationErrorDetail
 * @param issues zod safeParse 失败后的 issue 数组
 * @returns 逐条映射的明细：path（点分字段路径）、message、code，附带 min/max 参数与 rule 标记
 *          （rule 来自 schema 中 refine 的 params.rule，如 imageUrl/nonBlank/passwordMismatch）
 */
export function formatZodIssues(issues: z.core.$ZodIssue[]): ValidationErrorDetail[] {
  return issues.map((issue) => {
    const detail: ValidationErrorDetail = {
      path: issue.path.join("."),

      message: issue.message,

      code: issue.code,
    };

    const extra = issue as { minimum?: unknown; maximum?: unknown; params?: unknown };
    const min = typeof extra.minimum === "number" ? extra.minimum : undefined;
    const max = typeof extra.maximum === "number" ? extra.maximum : undefined;

    if (min !== undefined || max !== undefined) {
      detail.params = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    }

    const rule = (extra.params as { rule?: unknown } | undefined)?.rule;
    if (typeof rule === "string") detail.rule = rule as ValidationRule;
    return detail;
  });
}
