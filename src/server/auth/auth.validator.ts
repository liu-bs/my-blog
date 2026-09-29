/**
 * @file auth.validator.ts
 * @description 认证领域入参校验，基于 zod schema 对注册、登录、改密、改资料请求体做解析与规范化（trim、邮箱转小写）
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

/** 注册校验器，校验失败统一抛「Registration validation failed」 */
const _parseRegister = createParser(registerSchema, "Registration validation failed");

/**
 * 解析并校验注册请求体
 * @param body 原始请求体，类型未知
 * @returns 规范化后的注册字段（email 已转小写）
 * @throws ValidationError 字段缺失或格式不合法时
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

/** 登录校验器，校验失败统一抛「Login validation failed」 */
const _parseLogin = createParser(loginSchema, "Login validation failed");

/**
 * 解析并校验登录请求体
 * @param body 原始请求体，类型未知
 * @returns 规范化后的登录字段（email 已转小写，与库中存储形式一致）
 * @throws ValidationError 字段缺失或格式不合法时
 */
export function parseLoginBody(body: unknown): { email: string; password: string } {
  const data = _parseLogin(body);

  return { ...data, email: data.email.toLowerCase() };
}

/** 改密校验器，校验失败统一抛「Change password validation failed」 */
export const parseChangePasswordBody = createParser(
  changePasswordSchema,
  "Change password validation failed",
);

/**
 * 解析并校验改资料请求体
 * @description 更新资料允许部分字段提交，因此逐个判断字段是否存在，存在才 trim 后写入结果，
 * 未提交的字段不出现在返回对象中，交由 service 层决定「保留原值」还是「置空」
 * @param body 原始请求体，类型未知
 * @returns 仅包含本次提交字段的对象（文本字段已 trim，avatar 保持原值）
 * @throws ValidationError 字段类型或长度不合法时
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
