/**
 * @file request.ts
 * @description 前端请求错误类型：fetch 封装抛出的 ApiRequestError，携带状态码、业务码与校验详情
 */
import type { ValidationErrorDetail } from "../ui";

/**
 * API 请求错误：请求失败时由前端 fetch 封装抛出，业务代码按状态码分支处理
 */
export class ApiRequestError extends Error {
  /**
   * @param status HTTP 状态码
   * @param code 后端业务状态码
   * @param message 错误提示文案
   * @param details 逐字段校验错误详情（422 等校验失败场景）
   */
  constructor(
    /** HTTP 状态码 */
    public readonly status: number,

    /** 后端业务状态码 */
    public readonly code: number,

    message: string,

    /** 逐字段校验错误详情 */
    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** 是否未授权（401，需重新登录） */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 是否无权限（403，已登录但无权操作） */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}
