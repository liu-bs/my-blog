/**
 * @file primitives.ts
 * @description 校验基础工具：图片 URL 安全规则、zod 校验问题到统一表单错误结构的转换器，
 *              不依赖具体业务 schema，可被前端表单与服务端写入口共用
 */
import type { z } from "zod/mini";
import type { ValidationErrorDetail, ValidationRule } from "../types/ui";

/** 图片链接不合法时的统一提示文案 */
export const IMAGE_URL_INVALID_MESSAGE = "请填写以 https 开头的图片链接，或以 / 开头的站内路径";

/**
 * 校验图片 URL 是否安全可展示
 * 允许两种形式：以 / 开头的站内路径（排除协议相对地址 //），或 https 协议的绝对地址
 * @param src 原始图片地址字符串
 * @returns 合法返回 true
 */
export function isSafeImageUrl(src: string): boolean {
  const value = src.trim();

  // 站内路径：以 / 开头且不能是协议相对地址（//evil.com）
  if (value.startsWith("/")) return !value.startsWith("//");
  // 绝对地址：必须是可解析且协议为 https
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 将 zod 校验问题列表转换为统一的表单错误详情数组
 * @param issues zod 校验产生的 issue 列表
 * @returns 含字段路径、文案、错误码及可选 min/max 参数的错误详情
 */
export function formatZodIssues(issues: z.core.$ZodIssue[]): ValidationErrorDetail[] {
  return issues.map((issue) => {
    const detail: ValidationErrorDetail = {
      /** 字段路径，嵌套字段以 . 连接 */
      path: issue.path.join("."),
      /** 校验失败提示文案 */
      message: issue.message,
      /** zod 错误码（如 too_small、invalid_format） */
      code: issue.code,
    };

    /** 提取 issue 上的长度边界与自定义参数，供 UI 展示具体限制 */
    const extra = issue as { minimum?: unknown; maximum?: unknown; params?: unknown };
    const min = typeof extra.minimum === "number" ? extra.minimum : undefined;
    const max = typeof extra.maximum === "number" ? extra.maximum : undefined;

    if (min !== undefined || max !== undefined) {
      detail.params = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    }

    /** 业务自定义规则标识（如 imageUrl、nonBlank），映射为前端可识别的 ValidationRule */
    const rule = (extra.params as { rule?: unknown } | undefined)?.rule;
    if (typeof rule === "string") detail.rule = rule as ValidationRule;
    return detail;
  });
}
