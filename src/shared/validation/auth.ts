/**
 * @file auth.ts
 * @description 账号相关 zod（mini）校验 schema：注册、登录、修改密码、更新个人资料。
 * 服务端经 server/auth/auth.validator.ts（createParser）使用；
 * 客户端表单 LoginForm、RegisterForm、SettingsForm 直接用同名 schema 做前置校验，保证两端规则一致。
 */

import { z } from "zod/mini";
import { optionalImageUrlSchema } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/** 密码通用规则：6-128 位，注册与改密共用 */
const passwordSchema = z
  .string()
  .check(z.minLength(6, "密码长度不能少于6位"), z.maxLength(128, "密码长度不能超过128位"));

/**
 * 构造"trim 后限制长度"的字符串校验管道
 * @param field 字段中文名，用于拼装超长错误消息
 * @param min 最短长度
 * @param minMsg 为空/过短的错误消息
 * @param max 最长长度
 * @returns zod schema：先转字符串并 trim，再校验长度区间
 */
function trimmed(field: string, min: number, minMsg: string, max: number) {
  return z
    .pipe(
      z.pipe(
        z.unknown(),
        z.transform((val) => (typeof val === "string" ? val.trim() : val)),
      ),
      z.string(),
    )
    .check(z.minLength(min, minMsg), z.maxLength(max, `${field}不能超过${max}个字符`));
}

/** 注册表单/接口校验：邮箱、密码、昵称、姓（可选）、用户名（3-30 位字母数字下划线） */
export const registerSchema = z.object({
  /** 注册邮箱，需为合法邮箱格式 */
  email: z.email("邮箱格式不正确"),

  /** 登录密码，6-128 位 */
  password: passwordSchema,

  /** 昵称（名），trim 后 1-50 字符 */
  firstName: trimmed("昵称", 1, "昵称不能为空", 50),

  /** 姓氏，可选，trim 后最长 50 字符 */
  lastName: z.optional(trimmed("姓", 0, "姓不能为空", 50)),

  /** 用户名，trim 后 3-30 字符且仅允许字母、数字、下划线 */
  username: trimmed("用户名", 3, "用户名长度不能少于3位", 30).check(
    z.regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  ),
});

/** 登录表单/接口校验：邮箱自动 trim，密码仅要求非空（长度不校验以免泄露规则） */
export const loginSchema = z.object({
  /** 登录邮箱，trim 后校验邮箱格式 */
  email: z.pipe(
    z.pipe(
      z.unknown(),
      z.transform((val) => (typeof val === "string" ? val.trim() : val)),
    ),
    z.email("邮箱格式不正确"),
  ),

  /** 登录密码，仅校验非空 */
  password: z.string().check(z.minLength(1, "密码不能为空")),
});

/** 修改密码的两个入参字段（不含确认密码，确认密码在前端单独比对） */
export const changePasswordFieldsSchema = z.object({
  /** 当前密码，非空 */
  currentPassword: z.string().check(z.minLength(1, "当前密码不能为空")),

  /** 新密码，6-128 位 */
  newPassword: passwordSchema,
});

/** 完整改密校验：在字段规则基础上追加"新旧密码不能相同"的跨字段 refine */
export const changePasswordSchema = changePasswordFieldsSchema.check(
  z.refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
    params: { rule: "passwordMismatch" },
  }),
);

/** 设置页个人资料更新校验，全部字段可选（Partial 更新语义） */
export const updateProfileSchema = z.object({
  /** 昵称（名），最长 50 字符 */
  firstName: z.optional(z.string().check(z.maxLength(50, "名不能超过50个字符"))),

  /** 姓氏，最长 50 字符 */
  lastName: z.optional(z.string().check(z.maxLength(50, "姓不能超过50个字符"))),

  /** 头像 URL，可选，最长 500 字符，需通过 isSafeImageUrl（https 或站内路径） */
  avatar: optionalImageUrlSchema("头像URL", 500, IMAGE_URL_INVALID_MESSAGE),

  /** 个人简介，最长 280 字符 */
  bio: z.optional(z.string().check(z.maxLength(280, "简介不能超过280个字符"))),

  /** 所在地，最长 100 字符 */
  location: z.optional(z.string().check(z.maxLength(100, "所在地不能超过100个字符"))),

  /** 个人网站，最长 200 字符；空串或 http(s):// 开头才合法 */
  website: z.optional(
    z.string().check(
      z.maxLength(200, "网站URL不能超过200个字符"),
      z.refine(
        (url) => url === "" || /^https?:\/\//.test(url),
        "网站URL必须以 http:// 或 https:// 开头",
      ),
    ),
  ),
});

/** 登录表单可出现字段级错误的字段名（配合 FieldErrors/LoginForm 反馈） */
export type LoginField = "email" | "password";

/** 改密表单可出现字段级错误的字段名（含前端比对的 confirmPassword） */
export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/** 个人资料表单可出现字段级错误的字段名（SettingsForm 使用） */
export type ProfileField = "firstName" | "avatar" | "bio" | "location" | "website";
