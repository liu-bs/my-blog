/**
 * @file message.ts
 * @description 错误/校验信息文案解析：将 HTTP 状态码、ApiRequestError 与后端校验明细（ValidationRule/issue code）
 * 映射为中文用户文案，字段名与模板均来自 @/texts 文案字典
 */
import type { ValidationRule } from "@shared";
import { formatTemplate, messages } from "@/texts";

/** 可提示实体（post/comment/user 等）的文案 key */
export type EntityKey = keyof (typeof messages)["feedback"]["entity"];

/**
 * 获取实体的中文展示名
 * @param name 实体 key {@link EntityKey}
 * @returns 实体文案，如 "帖子"、"评论"
 */
export function entityName(name: EntityKey): string {
  return messages.feedback.entity[name];
}

/**
 * 按字段路径查字段中文名
 * @param name 字段英文路径
 * @returns 字段文案；字典未收录返回 undefined
 */
function fieldName(name: string): string | undefined {
  const dict: Record<string, string> = messages.feedback.field;
  return dict[name];
}

/** HTTP status -> common 文案 key 的映射表；0 代表网络层错误 */
const STATUS_MESSAGES: Record<number, { key: string }> = {
  0: { key: "networkError" },
  401: { key: "sessionExpired" },
  403: { key: "forbidden" },
  404: { key: "contentGone" },
  408: { key: "timeout" },
  429: { key: "rateLimited" },
  500: { key: "unknownError" },
};

/**
 * 从任意抛出物上探测数字 status 属性
 * @param err 未知抛出物
 * @returns status 数值；不存在或非数字返回 null
 */
function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

/**
 * 将错误对象转为用户可读文案
 * @param err 任意抛出物，通常带 status（如 ApiRequestError）
 * @param fallback 无 status 时的兜底文案
 * @returns 映射后的中文文案；未识别的 4xx 统一"操作失败"，5xx 及未知统一"未知错误"
 */
export function errorToMsg(err: unknown, fallback?: string): string {
  const status = statusOf(err);
  if (status === null) return fallback ?? messages.feedback.common.unknownError;
  const mapped = STATUS_MESSAGES[status];

  if (mapped) {
    const dict: Record<string, string> = messages.feedback.common;
    return formatTemplate(dict[mapped.key] ?? mapped.key);
  }

  if (status < 500) return messages.feedback.common.actionFailed;
  return messages.feedback.common.unknownError;
}

/**
 * 将单条校验明细（字段路径 + 规则/issue code + 参数）转成中文文案
 * @param detail.path 字段路径
 * @param detail.code zod issue code（too_small/too_big 等）
 * @param detail.rule 业务校验规则（imageUrl/nonBlank/passwordMismatch），优先于 code
 * @param detail.params 规则参数（min/max），用于长度类文案
 * @returns 形如 "请输入标题"、"内容太短（至少 10 字）" 的文案；字段未识别时返回通用"格式不正确"文案
 */
export function detailToMsg(detail: {
  path: string;
  code?: string;
  rule?: ValidationRule;
  params?: { min?: number; max?: number };
}): string {
  const label = fieldName(detail.path);
  const form = messages.feedback.form;
  const invalid = form.invalidField;

  // 业务规则优先于 zod code 匹配文案
  if (detail.rule) {
    switch (detail.rule) {
      case "imageUrl":
        return form.imageUrl;
      case "nonBlank":
        return label ? formatTemplate(form.requiredInput, { field: label }) : invalid;
      case "passwordMismatch":
        return form.sameAsCurrent;
    }
  }

  switch (detail.code) {
    case "too_small": {
      if (!label) return invalid;

      // min 缺省按 1 处理：min<=1 视为必填为空，否则提示长度不足
      const min = detail.params?.min ?? 1;
      return min <= 1
        ? formatTemplate(form.requiredInput, { field: label })
        : formatTemplate(form.tooShort, { field: label, min });
    }
    case "too_big": {
      const max = detail.params?.max;
      if (!label || max === undefined) return invalid;
      return formatTemplate(form.tooLong, { field: label, max });
    }
    default:
      return label ? formatTemplate(form.format, { field: label }) : invalid;
  }
}
