/**
 * @file request.ts
 * @description 客户端请求错误类型：`@/lib/apiRequest` 在 REST 响应失败或 {@link ActionResult} 拆包
 *              （`unwrap()`）失败时抛出 {@link ApiRequestError}，供组件按状态码分支处理（如跳登录、表单标红）。
 */
import type { ValidationErrorDetail } from "../ui";

/**
 * API 请求错误
 * @description 区分 HTTP 传输状态（status）与业务错误码（code，见 {@link ApiResponse}），
 *              并透传字段级校验错误 details 以定位到具体表单控件。
 */
export class ApiRequestError extends Error {
  constructor(
    /** HTTP 响应状态码，如 401-未登录、403-无权限、404-资源不存在 */
    public readonly status: number,

    /** 业务错误码（ApiResponse.code），0 以外的值；网络层错误时为封装层约定的缺省码 */
    public readonly code: number,

    /** 可读错误消息，可直接展示给用户 */
    message: string,

    /** 字段级校验错误列表（{@link ValidationErrorDetail}），仅 400 校验失败时携带 */
    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** 是否为未登录/凭证失效（HTTP 401），命中时通常引导用户重新登录 */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 是否为权限不足（HTTP 403），已登录但无操作资格，命中时仅提示不跳登录 */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}
