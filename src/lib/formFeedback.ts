/**
 * @file formFeedback.ts
 * @description 表单错误反馈的统一映射层：把「服务端返回的 ApiRequestError」或「zod 校验结果」整理成
 * 字段级错误（回填到输入框）+ 表单级错误（展示在表单顶部）+ toast 三类反馈，供各表单共用
 */
import type { z } from "zod/mini";
import { ApiRequestError, formatZodIssues, type ValidationErrorDetail } from "@shared";
import { notify } from "@/lib/toast";
import { currentMsgLocale, detailToMsg, errorToMsg } from "@/lib/message";

/** 字段名到错误文案的映射；值缺失表示该字段无错误 */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** 表单反馈结果 */
export interface FeedbackResult<F extends string> {
  /** 需要回填到各输入框的错误文案 */
  fields: FieldErrors<F>;

  /** 表单级错误文案（无字段归属的错误聚合，或整表失败提示）；无则为 null */
  form: string | null;
}

/**
 * 内部分类结果，比 {@link FeedbackResult} 多一个 toast 文案
 */
interface ErrorFeedback<F extends string> extends FeedbackResult<F> {
  /** 需要以 toast 形式提示的文案；走字段回填时为 null */
  toastMessage: string | null;
}

/**
 * 按 HTTP 状态码定制的覆盖规则
 * @description 取值说明：给定完整的 FeedbackResult 表示直接采用该字段/表单反馈；
 * 给定 `{ toast }` 表示这种情况不落在表单上，改为弹一条 toast
 */
type StatusOverride<F extends string> = FeedbackResult<F> | { toast: string };

/**
 * 错误分类所需的上下文
 */
export interface ErrorFeedbackOptions<F extends string> {
  /** 当前表单认识的字段名列表；服务端 details 中不属于这里的字段会被当作表单级错误 */
  fields: readonly F[];

  /** 无可用信息时的兜底文案 */
  fallback: string;

  /** 针对特定状态码的定制处理，优先级高于通用分类逻辑 */
  byStatus?: Record<number, StatusOverride<F>>;
}

/**
 * 会被当作「表单级错误」而非 toast 的状态码
 * @description 400/409/422 通常携带 zod 校验 details，适合回填到表单让用户逐项修正；
 * 其他状态（如 5xx）不指向具体字段，弹 toast 更合适
 */
const FORM_LEVEL_STATUSES = new Set([400, 409, 422]);

/**
 * 多条错误拼接时的分隔符，随当前语言变化
 * @returns 英文环境用 "; "，中文环境用全角 "；"
 */
function separator(): string {
  return currentMsgLocale() === "en" ? "; " : "；";
}

/**
 * 把任意错误归类为字段级 / 表单级 / toast 反馈
 * @description 优先级：状态码覆盖规则 > 表单级状态码的错误详情 > 普通错误（转 toast）
 * @param err 捕获到的错误
 * @param options 分类上下文 {@link ErrorFeedbackOptions}
 * @returns 含 toastMessage 的完整反馈 {@link ErrorFeedback}
 */
function classifyError<F extends string>(
  err: unknown,
  options: ErrorFeedbackOptions<F>,
): ErrorFeedback<F> {
  const { fields: knownFields, fallback, byStatus } = options;
  const empty: ErrorFeedback<F> = { fields: {}, form: null, toastMessage: null };

  const apiError = err instanceof ApiRequestError ? err : null;

  // 1) 状态码覆盖规则优先
  const override = apiError ? byStatus?.[apiError.status] : undefined;
  if (override) {
    if ("toast" in override) return { fields: {}, form: null, toastMessage: override.toast };
    return { ...override, toastMessage: null };
  }

  // 2) 校验类状态码：把 details 拆成「落在已知字段」与「无归属」两部分
  if (apiError && FORM_LEVEL_STATUSES.has(apiError.status)) {
    const fields: FieldErrors<F> = {};
    const orphans: string[] = [];
    for (const detail of apiError.details ?? []) {
      const text = detailToMsg(detail);
      const field = detail.path as F;
      // 同一字段多条错误只保留第一条，避免覆盖后被后一条冲掉
      if (knownFields.includes(field)) fields[field] ??= text;
      else orphans.push(text);
    }

    const hasDetails = (apiError.details?.length ?? 0) > 0;
    // 有孤儿错误聚合成表单级；有详情但都能归属到字段时不额外提示；一条详情都没有才用兜底文案
    const form = orphans.length ? orphans.join(separator()) : hasDetails ? null : fallback;
    return { fields, form, toastMessage: null };
  }

  // 3) 其余错误统一转成 toast 文案
  const plainError = err instanceof Error ? err : new Error(String(err));
  return {
    ...empty,
    toastMessage: errorToMsg(plainError, currentMsgLocale(), fallback || undefined),
  };
}

/**
 * 处理提交失败并返回可直接渲染的反馈
 * @description 与 classifyError 的区别是：toast 类反馈在这里就地弹出，调用方只需处理返回的 fields/form
 * @param err 提交时抛出的错误
 * @param options 分类上下文 {@link ErrorFeedbackOptions}
 * @returns 字段级与表单级反馈 {@link FeedbackResult}
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
 * 把 Server Action 的失败结果还原为可被 resolveSubmitError 识别的错误
 * @param result 失败分支的结构（status/message/details）
 * @returns 对应的 ApiRequestError 实例
 */
export function actionFailure(result: {
  status: number;
  message: string;
  details?: ValidationErrorDetail[];
}): ApiRequestError {
  return new ApiRequestError(result.status, result.status, result.message, result.details);
}

/**
 * 提交前用 zod schema 做整表客户端校验
 * @param schema zod/mini schema
 * @param values 表单值
 * @param options.messages 指定字段的错误文案覆盖（优先于 schema 生成的文案）
 * @param options.knownFields 允许回填的字段白名单；不在其中的错误会被视为表单级
 * @returns 校验通过时 fields/form 均为空 {@link FeedbackResult}
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
      // 已指定的自定义文案优先，且同字段只取首条
      fields[field] ??= messages?.[field] ?? detailToMsg(detail);
    } else {
      // 无字段归属的错误（如跨字段校验）汇总到表单级
      orphans.push(detailToMsg(detail));
    }
  }

  return { fields, form: orphans.length ? orphans.join(separator()) : null };
}

/**
 * 单字段即时校验（失焦等场景）
 * @param fieldSchema 该字段对应的 schema
 * @param value 当前字段值
 * @param message 可选的自定义错误文案，优先于 schema 生成的
 * @returns 校验通过返回 null，否则返回错误文案
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
 * 聚焦到第一个出错的字段
 * @description 用 requestAnimationFrame 延后到错误文案渲染完成后再查询，确保能命中；
 * 依赖给输入框设置 aria-invalid="true" 作为定位标记
 */
export function focusFirstInvalid(): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

/**
 * 判断反馈结果是否包含任何错误
 * @param result 反馈结果
 * @returns 存在字段错误或表单级错误时返回 true
 */
export function hasFeedback<F extends string>(result: FeedbackResult<F>): boolean {
  return Object.keys(result.fields).length > 0 || !!result.form;
}
