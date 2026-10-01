/**
 * @file appError.ts
 * @description 应用错误体系：AppError 基类携带 HTTP 状态码与业务错误码，派生各语义化 HTTP 错误子类；
 * 附带类型守卫，兼容错误经结构化克隆等序列化边界后丢失原型链的识别场景。
 */
import type { ValidationErrorDetail } from "@shared";

/** 跨模块识别 AppError 的品牌 Symbol，借助 Symbol.for 保证跨模块实例/副本识别一致 */
const APP_ERROR_BRAND = Symbol.for("my-app/app-error");

/**
 * 应用错误基类
 * @description 携带 HTTP 状态码与业务错误码，是 toFailure 转 ActionResult 的统一错误来源；
 * 实例上以品牌 Symbol（enumerable）标记，供 isAppError 做结构化识别
 */
export class AppError extends Error {
  /**
   * 构造应用错误
   * @param statusCode HTTP 状态码（如 400、404）
   * @param code 业务错误码（如 "ValidationError"）
   * @param message 错误信息
   * @param details 可选的字段级校验错误明细
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
 * 判断未知值是否为应用错误（AppError 或结构兼容的副本）
 * @description 除 instanceof 外，还识别品牌 Symbol 及 statusCode/code/message 结构，
 * 兼容错误经结构化克隆等边界后丢失原型链的场景
 * @param err 未知错误值
 * @returns 类型守卫：true 时可将 err 收窄为 AppError
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
 * 判断错误是否为应用错误且状态码与指定值一致
 * @param err 未知错误值
 * @param statusCode 期望的 HTTP 状态码
 * @returns 类型守卫：true 时可将 err 收窄为 AppError
 */
export function isAppErrorWithStatus(err: unknown, statusCode: number): err is AppError {
  return isAppError(err) && err.statusCode === statusCode;
}

/** 未认证错误：401，提示先登录 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized, please log in first") {
    super(401, "Unauthorized", message);
  }
}

/** 权限不足错误：403 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "Forbidden", message);
  }
}

/** 资源不存在错误：404 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NotFound", message);
  }
}

/** 资源冲突错误：409，如重复创建、唯一约束冲突 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, "Conflict", message);
  }
}

/** 服务器内部错误：500 */
export class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(500, "InternalServerError", message);
  }
}

/** 请求参数校验失败错误：400，可携带字段级错误明细 */
export class ValidationError extends AppError {
  constructor(message = "Request validation failed", details?: ValidationErrorDetail[]) {
    super(400, "ValidationError", message, details);
  }
}

/** 请求内容语义无效错误：422，语法正确但业务上不可处理 */
export class UnprocessableEntityError extends AppError {
  constructor(message = "Request content is invalid", details?: ValidationErrorDetail[]) {
    super(422, "UnprocessableEntity", message, details);
  }
}

/** 请求过于频繁错误：429，命中限流阈值 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "RateLimitError", message);
  }
}
