/**
 * @file index.ts
 * @description 服务端错误模块统一出口：集中再导出 AppError 基类、各 HTTP 语义派生错误
 * 及类型守卫（isAppError / isAppErrorWithStatus）。
 * 业务代码一律从 "@server/common/errors" 导入，不要直接引用 appError.ts，便于后续内部文件拆分。
 */
export {
  /** 业务错误基类，携带 statusCode/code/details */
  AppError,
  /** HTTP 401 未登录 */
  UnauthorizedError,
  /** HTTP 403 权限不足 */
  ForbiddenError,
  /** HTTP 404 资源不存在 */
  NotFoundError,
  /** HTTP 409 资源冲突 */
  ConflictError,
  /** HTTP 500 服务器内部错误 */
  InternalServerError,
  /** HTTP 400 参数校验失败 */
  ValidationError,
  /** HTTP 422 内容语义错误 */
  UnprocessableEntityError,
  /** HTTP 429 触发限流 */
  RateLimitError,
  /** 判断任意错误是否为 AppError 的类型守卫 */
  isAppError,
  /** 判断 AppError 是否匹配指定 HTTP 状态码的类型守卫 */
  isAppErrorWithStatus,
} from "./appError";
