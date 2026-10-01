/**
 * @file index.ts
 * @description 应用错误体系统一出口，集中导出 AppError 基类、各语义化 HTTP 错误子类及类型守卫。
 */
export {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  ValidationError,
  UnprocessableEntityError,
  RateLimitError,
  isAppError,
  isAppErrorWithStatus,
} from "./appError";
