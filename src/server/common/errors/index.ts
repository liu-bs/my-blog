/**
 * @file index.ts
 * @description 错误模块的统一出口：业务代码一律从 "@server/common/errors" 导入，不直接依赖 appError 具体文件，
 * 这样后续拆分错误类时不必改动调用方。
 */
export {
  /** 应用错误基类，业务一般不直接抛它 */
  AppError,
  /** 401 未登录 / 令牌失效 */
  UnauthorizedError,
  /** 403 已登录但无权限 */
  ForbiddenError,
  /** 404 资源不存在 */
  NotFoundError,
  /** 409 资源冲突，如用户名 / 邮箱被占用 */
  ConflictError,
  /** 500 服务端内部错误 */
  InternalServerError,
  /** 400 请求参数校验失败 */
  ValidationError,
  /** 422 请求内容语义非法 */
  UnprocessableEntityError,
  /** 429 请求过于频繁 */
  RateLimitError,
  /** 判断任意值是否为 AppError */
  isAppError,
  /** 判断是否为指定状态码的 AppError */
  isAppErrorWithStatus,
} from "./appError";
