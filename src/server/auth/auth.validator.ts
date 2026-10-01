/**
 * @file auth.validator.ts
 * @description 认证相关请求体校验器。基于共享 zod schema 创建解析器并做规范化处理
 * （登录/注册邮箱统一转小写，资料字段去除首尾空白），校验失败抛出带字段明细的 ValidationError。
 */
import "server-only";
import { createParser } from "@server/common/zod";
import { ValidationError } from "@server/common/errors";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/shared/validation/auth";
import { formatZodIssues } from "@shared";

const _parseRegister = createParser(registerSchema, "Registration validation failed");

/**
 * 解析并校验注册请求体
 * @param body 未知请求体
 * @returns 注册字段（email 已统一转为小写）
 * @throws 校验失败时抛出 ValidationError
 */
export function parseRegisterBody(body: unknown): {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
} {
  const data = _parseRegister(body);

  return { ...data, email: data.email.toLowerCase() };
}

const _parseLogin = createParser(loginSchema, "Login validation failed");

/**
 * 解析并校验登录请求体
 * @param body 未知请求体
 * @returns 登录凭据（email 已统一转为小写）
 * @throws 校验失败时抛出 ValidationError
 */
export function parseLoginBody(body: unknown): { email: string; password: string } {
  const data = _parseLogin(body);

  return { ...data, email: data.email.toLowerCase() };
}

/** 修改密码请求体解析器 */
export const parseChangePasswordBody = createParser(
  changePasswordSchema,
  "Change password validation failed",
);

/**
 * 解析并校验资料更新请求体
 * 仅保留 schema 中定义的字段，文本字段去除首尾空白
 * @param body 未知请求体
 * @returns 允许更新的字段子集（undefined 字段表示不更新）
 * @throws 校验失败时抛出 ValidationError
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
