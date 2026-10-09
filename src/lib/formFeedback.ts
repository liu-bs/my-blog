/**
 * @file formFeedback.ts
 * @description 表单错误反馈统一处理：将服务端 ApiRequestError（按 HTTP status 与校验 details）与本地 zod mini schema
 * 校验结果归一为"字段级错误 + 表单级错误"结构，支持按状态码覆盖展示方式；并提供聚焦首个错误字段等辅助函数
 */
import type { z } from "zod/mini";
import { ApiRequestError, formatZodIssues, type ValidationErrorDetail } from "@shared";
import { notify } from "@/lib/toast";
import { detailToMsg, errorToMsg } from "@/lib/message";

/**
 * 字段级错误映射：字段名 -> 展示文案，未出错的字段缺席
 */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/**
 * 表单反馈结果
 */
export interface FeedbackResult<F extends string> {
  /** 字段级错误集合 */
  fields: FieldErrors<F>;

  /** 表单级（非某字段）错误文案，无则为 null */
  form: string | null;
}

/**
 * 内部错误分类结果：在反馈结果基础上附带需要 toast 的文案
 */
interface ErrorFeedback<F extends string> extends FeedbackResult<F> {
  /** 需要以 toast 提示的文案；为 null 表示错误落在表单内展示 */
  toastMessage: string | null;
}

/**
 * 状态码覆盖配置：要么给出字段/表单结构，要么给出纯 toast 文案
 */
type StatusOverride<F extends string> = FeedbackResult<F> | { toast: string };

/**
 * 错误反馈选项
 */
export interface ErrorFeedbackOptions<F extends string> {
  /** 表单已知字段名列表，用于区分字段级错误与游离（孤儿）错误 */
  fields: readonly F[];

  /** 无明细时的表单级兜底文案 */
  fallback: string;

  /** 按 HTTP status 定制展示：覆盖默认的字段级归类逻辑 */
  byStatus?: Record<number, StatusOverride<F>>;
}

/** 视为表单校验错误的状态码集合：400/409/422，错误明细落到字段或表单展示 */
const FORM_LEVEL_STATUSES = new Set([400, 409, 422]);

/**
 * 多条游离错误的拼接分隔符
 * @returns 全角分号
 */
function separator(): string {
  return "；";
}

/**
 * 将任意抛出物分类为字段/表单/toast 三种反馈形态
 * @param err 捕获的错误（ApiRequestError 或其他）
 * @param options {@link ErrorFeedbackOptions}
 * @returns 带 toastMessage 的内部反馈结构
 */
function classifyError<F extends string>(
  err: unknown,
  options: ErrorFeedbackOptions<F>,
): ErrorFeedback<F> {
  const { fields: knownFields, fallback, byStatus } = options;
  const empty: ErrorFeedback<F> = { fields: {}, form: null, toastMessage: null };

  const apiError = err instanceof ApiRequestError ? err : null;

  // 优先命中状态码覆盖配置
  const override = apiError ? byStatus?.[apiError.status] : undefined;
  if (override) {
    if ("toast" in override) return { fields: {}, form: null, toastMessage: override.toast };
    return { ...override, toastMessage: null };
  }

  // 表单级状态：把校验明细分配到已知字段，未知字段的游离错误拼接为表单级文案
  if (apiError && FORM_LEVEL_STATUSES.has(apiError.status)) {
    const fields: FieldErrors<F> = {};
    const orphans: string[] = [];
    for (const detail of apiError.details ?? []) {
      const text = detailToMsg(detail);
      const field = detail.path as F;

      // 同一字段多条错误时保留首条
      if (knownFields.includes(field)) fields[field] ??= text;
      else orphans.push(text);
    }

    const hasDetails = (apiError.details?.length ?? 0) > 0;

    // 游离错误优先展示；有明细但全落字段则不重复报表单级；完全无明细用兜底文案
    const form = orphans.length ? orphans.join(separator()) : hasDetails ? null : fallback;
    return { fields, form, toastMessage: null };
  }

  // 其余错误（5xx、网络等）一律转为 toast 文案
  const plainError = err instanceof Error ? err : new Error(String(err));
  return {
    ...empty,
    toastMessage: errorToMsg(plainError, fallback || undefined),
  };
}

/**
 * 提交失败的统一出口：分类错误、按需弹 toast 并返回可渲染的表单反馈
 * @param err 提交过程中捕获的错误
 * @param options {@link ErrorFeedbackOptions}
 * @returns {@link FeedbackResult}（fields + form），toastMessage 已在此内部消费
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
 * 将 Server Action 的失败信封（ActionResult 非 ok 分支）转为 ApiRequestError
 * @param result 含 status/message/可选 details 的失败结果
 * @returns 可直接 throw 的 {@link ApiRequestError}，使 Action 失败复用表单错误分类逻辑
 */
export function actionFailure(result: {
  status: number;
  message: string;
  details?: ValidationErrorDetail[];
}): ApiRequestError {
  return new ApiRequestError(result.status, result.status, result.message, result.details);
}

/**
 * 本地 zod mini schema 表单校验
 * @param schema 整表 zod mini schema
 * @param values 待校验的表单值
 * @param options messages：字段名->自定义文案覆盖；knownFields：限定归属到字段的错误，其余归为表单级
 * @returns 校验通过返回空反馈；失败返回字段级与表单级文案
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
      // 自定义文案优先；同字段多条错误保留首条
      fields[field] ??= messages?.[field] ?? detailToMsg(detail);
    } else {
      orphans.push(detailToMsg(detail));
    }
  }

  return { fields, form: orphans.length ? orphans.join(separator()) : null };
}

/**
 * 单字段值校验（失焦/变更时即时校验）
 * @param fieldSchema 该字段的 zod mini schema
 * @param value 字段值
 * @param message 失败时的自定义文案，缺省用 schema issue 推导文案
 * @returns 错误文案；校验通过返回 null
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

/**
 * 聚焦表单中第一个 aria-invalid="true" 的字段
 * @warning 需在错误渲染后调用；内部经 requestAnimationFrame 延后一帧以等待 DOM 更新；服务端环境静默跳过
 */
export function focusFirstInvalid(): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

/**
 * 判断反馈结果是否含任何错误
 * @param result {@link FeedbackResult}
 * @returns 存在字段级错误或表单级文案时返回 true
 */
export function hasFeedback<F extends string>(result: FeedbackResult<F>): boolean {
  return Object.keys(result.fields).length > 0 || !!result.form;
}
