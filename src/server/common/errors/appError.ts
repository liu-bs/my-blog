/**
 * @file appError.ts
 * @description 服务端统一错误体系：AppError 基类携带 HTTP 状态码、业务错误码与可选校验明细，
 * 派生类覆盖常见 HTTP 语义（401/403/404/409/400/422/429/500）。
 * 业务层（server/... service、defineRoute 包装的 REST 路由）通过抛出这些错误表达失败，
 * 由 @server/common/http/api-response 的 sendError 统一转换为 ApiResponse 信封；
 * isAppError 用于跨模块/跨序列化边界识别错误对象。仅限服务端使用。
 */
import type { ValidationErrorDetail } from "@shared";

/** AppError 品牌标记 symbol：经 Symbol.for 全局注册，跨模块实例也能被 isAppError 识别 */
const APP_ERROR_BRAND = Symbol.for("my-app/app-error");

/**
 * 服务端业务错误基类
 * @description 携带 HTTP 状态码与业务错误码，供 sendError 映射为标准响应体
 */
export class AppError extends Error {
  /**
   * 构造业务错误
   * @param statusCode HTTP 状态码，同时作为响应体 code 字段（如 400/401/404/500）
   * @param code 业务错误码字符串（如 "Unauthorized"），用于日志与排查
   * @param message 可读错误信息；4xx 会原样返回给客户端，5xx 会被兜底文案替换
   * @param details 字段级校验错误明细列表，仅 4xx 响应携带，可为 undefined
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;

    // 挂品牌标记属性：序列化/跨层传递后 instanceof 失效时仍可被 isAppError 识别
    Object.defineProperty(this, APP_ERROR_BRAND, { value: true, enumerable: true });
  }
}

/**
 * 判断未知错误是否为 AppError
 * @param err 任意捕获到的错误值
 * @returns 类型收窄后的判定结果：instanceof、品牌标记、或具备 statusCode/code/message 三要素的对象均视为 AppError
 */
export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true;
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as Record<symbol | "statusCode" | "code" | "message", unknown>;
  if (candidate[APP_ERROR_BRAND] === true) return true;

  // 结构兜底：未经 instanceof 传递的对象（如反序列化产物）按三要素duck typing判定
  return (
    typeof candidate.statusCode === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

/**
 * 判断未知错误是否为指定 HTTP 状态码的 AppError
 * @param err 任意捕获到的错误值
 * @param statusCode 期望匹配的 HTTP 状态码（如 401）
 * @returns 是 AppError 且 statusCode 匹配时返回 true
 */
export function isAppErrorWithStatus(err: unknown, statusCode: number): err is AppError {
  return isAppError(err) && err.statusCode === statusCode;
}

/**
 * 未登录错误（HTTP 401，code "Unauthorized"）
 * @description 客户端 apiRequest 收到 401 时会先尝试刷新 token，失败则跳转登录页
 */
export class UnauthorizedError extends AppError {
  /**
   * @param message 错误文案，默认 "Unauthorized, please log in first"
   */
  constructor(message = "Unauthorized, please log in first") {
    super(401, "Unauthorized", message);
  }
}

/**
 * 权限不足错误（HTTP 403，code "Forbidden"）
 * @description 已登录但无权操作目标资源时使用
 */
export class ForbiddenError extends AppError {
  /**
   * @param message 错误文案，默认 "Forbidden"
   */
  constructor(message = "Forbidden") {
    super(403, "Forbidden", message);
  }
}

/**
 * 资源不存在错误（HTTP 404，code "NotFound"）
 * @description 查询目标（文章、评论、用户等）不存在或已删除时使用
 */
export class NotFoundError extends AppError {
  /**
   * @param message 错误文案，默认 "Resource not found"
   */
  constructor(message = "Resource not found") {
    super(404, "NotFound", message);
  }
}

/**
 * 资源冲突错误（HTTP 409，code "Conflict"）
 * @description 唯一性约束冲突等场景使用，如重复登录名、重复收藏
 */
export class ConflictError extends AppError {
  /**
   * @param message 错误文案，默认 "Resource conflict"
   */
  constructor(message = "Resource conflict") {
    super(409, "Conflict", message);
  }
}

/**
 * 服务器内部错误（HTTP 500，code "InternalServerError"）
 * @description 5xx 的 message 会被 sendError 替换为通用兜底文案，真实原因只进日志
 */
export class InternalServerError extends AppError {
  /**
   * @param message 错误文案（仅入日志，不直接返回客户端），默认 "Internal server error"
   */
  constructor(message = "Internal server error") {
    super(500, "InternalServerError", message);
  }
}

/**
 * 请求参数校验错误（HTTP 400，code "ValidationError"）
 * @description 通常由 createParser 解析 zod schema 失败时抛出，details 携带字段级错误供表单标红
 */
export class ValidationError extends AppError {
  /**
   * @param message 错误文案，默认 "Request validation failed"
   * @param details 字段级校验错误明细，可为 undefined
   */
  constructor(message = "Request validation failed", details?: ValidationErrorDetail[]) {
    super(400, "ValidationError", message, details);
  }
}

/**
 * 请求内容语义错误（HTTP 422，code "UnprocessableEntity"）
 * @description 参数格式合法但业务上无法处理时使用，如状态不允许的操作
 */
export class UnprocessableEntityError extends AppError {
  /**
   * @param message 错误文案，默认 "Request content is invalid"
   * @param details 相关校验/业务明细，可为 undefined
   */
  constructor(message = "Request content is invalid", details?: ValidationErrorDetail[]) {
    super(422, "UnprocessableEntity", message, details);
  }
}

/**
 * 请求频率超限错误（HTTP 429，code "RateLimitError"）
 * @description defineRoute 的 rateLimit 选项命中限流时抛出
 */
export class RateLimitError extends AppError {
  /**
   * @param message 错误文案，默认 "Too many requests, please try again later"
   */
  constructor(message = "Too many requests, please try again later") {
    super(429, "RateLimitError", message);
  }
}
