/**
 * @file appError.ts
 * @description 服务端错误体系：用 AppError 基类统一承载「HTTP 状态码 + 业务 code + 可展示文案 + 校验明细」，
 * 各子类把「什么业务错误对应什么状态码」固化成构造函数参数，业务代码只需 `throw new NotFoundError()`。
 * 用继承而非散落的常量，是为了让错误可被 instanceof / isAppError 识别，从而由 sendError、toFailure 在一处完成日志与响应转换。
 * 使用限制：与网络 / 框架无关，前后端边界仅在 isAppError 的品牌标记上，允许跨 bundle 判断。
 */
import type { ValidationErrorDetail } from "@shared";

/**
 * 品牌标记
 * @description 用 Symbol.for 注册全局唯一 symbol，使同一份代码被不同 bundle 加载时仍共享同一标记；
 * 即使 instanceof 因跨包 / 重复实例化失效，也能靠该标记识别本应用的错误对象
 */
const APP_ERROR_BRAND = Symbol.for("my-app/app-error");

/**
 * 应用错误基类
 * @description 所有业务异常的公共父类，携带 HTTP 状态码与面向客户端的业务错误码；
 * 继承自 Error 是为了保留堆栈，便于 5xx 错误排查
 */
export class AppError extends Error {
  /**
   * @param statusCode HTTP 状态码，决定响应的 status 与「是否脱敏」
   * @param code 业务错误码字符串，用于日志检索与前端分支判断
   * @param message 面向用户或开发者的错误描述；5xx 时对外会被替换为通用文案
   * @param details 逐字段校验明细，仅 4xx 类校验错误会携带
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ValidationErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;

    Object.defineProperty(this, APP_ERROR_BRAND, { value: true, enumerable: true });
  }
}

/**
 * 判断任意值是否为 AppError
 * @param err 待判断的值
 * @returns 是应用错误返回 true
 * @description 三级判定：instanceof 命中即真；否则看品牌标记；再退化为「同时具备 statusCode / code / message」的结构判断，
 * 以兼容跨 bundle、被序列化后重建等 instanceof 失效的场景
 */
export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true;
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as Record<symbol | "statusCode" | "code" | "message", unknown>;
  if (candidate[APP_ERROR_BRAND] === true) return true;

  return (
    typeof candidate.statusCode === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

/**
 * 判断错误是否为 AppError 且状态码匹配
 * @param err 待判断的值
 * @param statusCode 期望的 HTTP 状态码
 * @returns 匹配返回 true
 * @description 用于把「某类错误」映射成特定处理分支，避免各处重复写 statusCode 比较
 */
export function isAppErrorWithStatus(err: unknown, statusCode: number): err is AppError {
  return isAppError(err) && err.statusCode === statusCode;
}

/**
 * 未登录 / 令牌失效
 * @description 对应 401，前端据此跳转登录；业务 code 为 "Unauthorized"
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized, please log in first") {
    super(401, "Unauthorized", message);
  }
}

/**
 * 已登录但无权限
 * @description 对应 403，典型场景是非本人操作他人评论 / 文章
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "Forbidden", message);
  }
}

/**
 * 资源不存在
 * @description 对应 404，覆盖文章 / 评论 / 用户被删除或 ID 非法
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NotFound", message);
  }
}

/**
 * 资源冲突
 * @description 对应 409，典型场景是注册时用户名或邮箱已被占用
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, "Conflict", message);
  }
}

/**
 * 服务端内部错误
 * @description 对应 500；对外响应会被脱敏为通用文案，真实 message 只进日志
 */
export class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(500, "InternalServerError", message);
  }
}

/**
 * 请求参数校验失败
 * @description 对应 400，通常由 zod 校验器抛出，details 携带逐字段错误
 */
export class ValidationError extends AppError {
  constructor(message = "Request validation failed", details?: ValidationErrorDetail[]) {
    super(400, "ValidationError", message, details);
  }
}

/**
 * 请求内容语义非法
 * @description 对应 422，与 400 的区别在于结构合法但业务上不可接受（如状态流转不满足前置条件）
 */
export class UnprocessableEntityError extends AppError {
  constructor(message = "Request content is invalid", details?: ValidationErrorDetail[]) {
    super(422, "UnprocessableEntity", message, details);
  }
}

/**
 * 请求过于频繁
 * @description 对应 429，由限流前置检查抛出
 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "RateLimitError", message);
  }
}
