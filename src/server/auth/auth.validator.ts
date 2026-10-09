import "server-only";

/**
 * @file 认证域参数校验器
 * @description 用 createParser 包装 @/shared/validation/auth 的 zod schema，供 auth.controller 各 Server Action 使用；
 * 校验失败统一抛 ValidationError（400 + zod issue 明细）。个别入口在校验后追加归一化处理（如邮箱转小写）。
 */
import { createParser } from "@server/common/zod";
import { ValidationError } from "@server/common/errors";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/shared/validation/auth";
import { formatZodIssues } from "@shared";

/** 注册 schema 的基础解析器（错误文案：Registration validation failed） */
const _parseRegister = createParser(registerSchema, "Registration validation failed");

/**
 * 校验并归一化注册请求体
 * @description lastName 缺省补空字符串；邮箱统一转小写，与查重/登录口径一致
 * @param body 前端传入的未知请求体
 * @returns 校验通过的注册 DTO
 * @throws ValidationError——字段不合法（400，携带 zod issue 明细）
 */
export function parseRegisterBody(body: unknown): {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
} {
  const data = _parseRegister(body);

  return { ...data, lastName: data.lastName ?? "", email: data.email.toLowerCase() };
}

/** 登录 schema 的基础解析器（错误文案：Login validation failed） */
const _parseLogin = createParser(loginSchema, "Login validation failed");

/**
 * 校验并归一化登录请求体（邮箱转小写）
 * @param body 前端传入的未知请求体
 * @returns 校验通过的登录 DTO（邮箱 + 密码）
 * @throws ValidationError——字段不合法（400）
 */
export function parseLoginBody(body: unknown): { email: string; password: string } {
  const data = _parseLogin(body);

  return { ...data, email: data.email.toLowerCase() };
}

/** 修改密码请求体解析器：直接复用 createParser，无额外归一化 */
export const parseChangePasswordBody = createParser(
  changePasswordSchema,
  "Change password validation failed",
);

/**
 * 校验并归一化资料更新请求体
 * @description 走 safeParse 而非 createParser，因为需要"只保留显式传入字段"实现 PATCH 语义：
 * undefined 字段不进入结果，字符串字段统一 trim
 * @param body 前端传入的未知请求体
 * @returns 仅含被更新字段的局部 DTO
 * @throws ValidationError——字段不合法（400，携带 zod issue 明细）
 */
export function parseUpdateProfileBody(body: unknown): Record<string, string | undefined> {
  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Profile validation failed", formatZodIssues(result.error.issues));
  }

  const data: Record<string, string | undefined> = {};
  const { firstName, lastName, avatar, bio, location, website } = result.data;
  if (firstName !== undefined) data.firstName = firstName.trim();
  if (lastName !== undefined) data.lastName = lastName.trim();
  if (avatar !== undefined) data.avatar = avatar;
  if (bio !== undefined) data.bio = bio.trim();
  if (location !== undefined) data.location = location.trim();
  if (website !== undefined) data.website = website.trim();
  return data;
}
