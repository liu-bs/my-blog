/**
 * @file formFeedback.ts
 * @description 表单提交反馈统一处理：把 ApiRequestError 按状态码与字段明细归类为字段错误/表单级错误/toast 文案，配合 zod 校验生成反馈，并可聚焦首个错误字段
 */
import type { z } from "zod/mini";
import { ApiRequestError, formatZodIssues, type ValidationErrorDetail } from "@shared";
import { notify } from "@/lib/toast";
import { currentMsgLocale, detailToMsg, errorToMsg } from "@/lib/message";

/**
 * 字段错误映射：字段名 -> 错误文案
 */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/**
 * 提交反馈结果
 */
export interface FeedbackResult<F extends string> {
  /** 字段级错误映射 */
  fields: FieldErrors<F>;

  /** 表单级错误文案，无则为 null */
  form: string | null;
}

/**
 * 错误归类结果，额外携带 toast 文案
 */
interface ErrorFeedback<F extends string> extends FeedbackResult<F> {
  /** 需要以 toast 展示的文案，无则为 null */
  toastMessage: string | null;
}

/**
 * 按状态码覆盖的反馈：完整反馈结果或仅 toast 文案
 */
type StatusOverride<F extends string> = FeedbackResult<F> | { toast: string };

/**
 * 错误归类配置
 */
export interface ErrorFeedbackOptions<F extends string> {
  /** 表单已知的字段名列表，用于区分字段错误与孤儿错误 */
  fields: readonly F[];

  /** 无明细可用时的兜底文案 */
  fallback: string;

  /** 按状态码覆盖默认归类结果 */
  byStatus?: Record<number, StatusOverride<F>>;
}

/** 视为表单校验/业务冲突类错误、需解析 details 的状态码 */
const FORM_LEVEL_STATUSES = new Set([400, 409, 422]);

/** 按当前语言返回错误文案分隔符 */
function separator(): string {
  return currentMsgLocale() === "en" ? "; " : "；";
}

/**
 * 将提交异常归类为字段错误/表单错误/toast 文案
 * @param err 提交抛出的异常
 * @param options 归类配置
 * @returns 归类结果
 */
function classifyError<F extends string>(
  err: unknown,
  options: ErrorFeedbackOptions<F>,
): ErrorFeedback<F> {
  const { fields: knownFields, fallback, byStatus } = options;
  const empty: ErrorFeedback<F> = { fields: {}, form: null, toastMessage: null };

  const apiError = err instanceof ApiRequestError ? err : null;

  const override = apiError ? byStatus?.[apiError.status] : undefined;
  if (override) {
    if ("toast" in override) return { fields: {}, form: null, toastMessage: override.toast };
    return { ...override, toastMessage: null };
  }

  if (apiError && FORM_LEVEL_STATUSES.has(apiError.status)) {
    const fields: FieldErrors<F> = {};
    const orphans: string[] = [];
    for (const detail of apiError.details ?? []) {
      const text = detailToMsg(detail);
      const field = detail.path as F;

      // 已知字段归入字段错误，未知字段归入孤儿文案
      if (knownFields.includes(field)) fields[field] ??= text;
      else orphans.push(text);
    }

    const hasDetails = (apiError.details?.length ?? 0) > 0;

    const form = orphans.length ? orphans.join(separator()) : hasDetails ? null : fallback;
    return { fields, form, toastMessage: null };
  }

  const plainError = err instanceof Error ? err : new Error(String(err));
  return {
    ...empty,
    toastMessage: errorToMsg(plainError, currentMsgLocale(), fallback || undefined),
  };
}

/**
 * 解析提交错误为表单反馈，需要 toast 的场景直接弹出
 * @param err 提交抛出的异常
 * @param options 归类配置
 * @returns 字段错误与表单级错误
 */
export function resolveSubmitError<F extends string>(
  err: unknown,
  options: ErrorFeedbackOptions<F>,
): FeedbackResult<F> {
  const outcome = classifyError(err, options);
  if (outcome.toastMessage) notify.fail(outcome.toastMessage);
  return { fields: outcome.fields, form: outcome.form };
}

/**
 * 把 Server Action 的失败结果转成 ApiRequestError，便于走统一错误反馈
 * @param result 失败的 ActionResult 摘要
 * @returns ApiRequestError 实例
 */
export function actionFailure(result: {
  status: number;
  message: string;
  details?: ValidationErrorDetail[];
}): ApiRequestError {
  return new ApiRequestError(result.status, result.status, result.message, result.details);
}

/**
 * 用 zod schema 校验表单值并生成反馈
 * @param schema zod schema
 * @param values 待校验的表单值
 * @param options 可选：字段文案覆盖与已知字段列表，未知字段的错误归入表单级错误
 * @returns 字段错误与表单级错误
 */
export function validateForm<F extends string>(
  schema: z.ZodMiniType,
  values: unknown,
  options: { messages?: Partial<Record<F, string>>; knownFields?: readonly F[] } = {},
): FeedbackResult<F> {
  const result = schema.safeParse(values);
  if (result.success) return { fields: {}, form: null };

  const { messages, knownFields } = options;
  const fields: FieldErrors<F> = {};
  const orphans: string[] = [];

  for (const detail of formatZodIssues(result.error.issues)) {
    const field = detail.path as F;
    if (field && (!knownFields || knownFields.includes(field))) {
      // 已知字段：优先使用自定义文案
      fields[field] ??= messages?.[field] ?? detailToMsg(detail);
    } else {
      // 未知字段归入表单级错误
      orphans.push(detailToMsg(detail));
    }
  }

  return { fields, form: orphans.length ? orphans.join(separator()) : null };
}

/**
 * 校验单个字段值
 * @param fieldSchema 字段 schema
 * @param value 字段值
 * @param message 自定义错误文案
 * @returns 错误文案，校验通过返回 null
 */
export function validateFieldValue(
  fieldSchema: z.ZodMiniType,
  value: unknown,
  message?: string,
): string | null {
  const result = fieldSchema.safeParse(value);
  if (result.success) return null;
  const [detail] = formatZodIssues(result.error.issues);
  return message ?? (detail ? detailToMsg(detail) : null);
}

/** 聚焦第一个校验失败（aria-invalid）的字段 */
export function focusFirstInvalid(): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

/**
 * 判断是否存在待展示的反馈
 * @param result 反馈结果
 * @returns 是否有字段或表单级错误
 */
export function hasFeedback<F extends string>(result: FeedbackResult<F>): boolean {
  return Object.keys(result.fields).length > 0 || !!result.form;
}
