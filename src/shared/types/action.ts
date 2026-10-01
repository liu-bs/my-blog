/**
 * @file action.ts
 * @description Server Action 统一返回类型：以可区分联合（ok 字段判别）承载成功数据或失败详情，
 *              失败分支携带 HTTP 风格状态码、提示文案及可选的逐字段校验错误
 */
import type { ValidationErrorDetail } from "./ui";

/**
 * Server Action 通用返回结果
 * ok 为 true 时携带数据 data；ok 为 false 时携带失败信息
 */
export type ActionResult<T> =
  /** 成功分支：携带业务数据 */
  | { ok: true; data: T }

  /** 失败分支：status 为 HTTP 风格状态码，message 为用户可读提示，details 为可选的逐字段校验错误 */
  | { ok: false; status: number; message: string; details?: ValidationErrorDetail[] };
