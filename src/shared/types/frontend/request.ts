/**
 * @file request.ts
 * @description 客户端请求错误类型。把 API 返回的 HTTP 状态、业务 code 与字段级校验详情
 *              统一封装成 Error，使调用方既能用 try/catch 处理，又能拿到结构化信息做分支判断。
 */
import type { ValidationErrorDetail } from "../ui";

/**
 * API 请求错误
 * @description 由请求封装在响应不成功（HTTP 非 2xx 或业务 code 非 0）时抛出；
 *              网络异常 / 超时等无响应场景以 status=0、code=0 构造。
 */
export class ApiRequestError extends Error {
  constructor(
    /** HTTP 状态码；网络异常或超时时为 0 */
    public readonly status: number,

    /** 后端业务状态码，取自响应信封的 code；无响应时为 0 */
    public readonly code: number,

    /** 可直接展示给用户的错误文案 */
    message: string,

    /** 字段级校验详情，仅在 422 等校验失败场景存在 */
    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /**
   * 是否为未认证（401）
   * @returns 401 时返回 true
   */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * 是否为无权限（403）
   * @returns 403 时返回 true
   */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}
