/**
 * @file auth.ts
 * @description 认证与账号资料的 zod/mini 校验 schema：注册、登录、修改密码、更新资料，
 *              字段规则与 i18n 文案中的提示保持一致（密码 6-128 位、用户名 3-30 位等）
 */
import { z } from "zod/mini";
import { optionalImageUrlSchema } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/** 密码通用规则：长度 6-128 位，注册与改密共用 */
const passwordSchema = z
  .string()
  .check(z.minLength(6, "密码长度不能少于6位"), z.maxLength(128, "密码长度不能超过128位"));

/**
 * 构造先裁剪再校验长度的字符串字段 schema
 * 先把非字符串原样透传、字符串去首尾空白，再按 min/max 校验长度
 * @param field 字段中文名，用于错误文案
 * @param min 最小长度
 * @param minMsg 长度不足时的提示文案
 * @param max 最大长度
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

/**
 * 注册表单校验 schema
 */
export const registerSchema = z.object({
  /** 邮箱，必须符合邮箱格式 */
  email: z.email("邮箱格式不正确"),

  /** 密码，6-128 位 */
  password: passwordSchema,

  /** 名，去除首尾空白后 1-50 字符 */
  firstName: trimmed("名", 1, "名不能为空", 50),

  /** 姓，去除首尾空白后 1-50 字符 */
  lastName: trimmed("姓", 1, "姓不能为空", 50),

  /** 用户名，去除首尾空白后 3-30 字符，且仅允许字母、数字、下划线 */
  username: trimmed("用户名", 3, "用户名长度不能少于3位", 30).check(
    z.regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  ),
});

/**
 * 登录表单校验 schema
 */
export const loginSchema = z.object({
  /** 邮箱，先去首尾空白再校验邮箱格式（容忍粘贴带入的空格） */
  email: z.pipe(
    z.pipe(
      z.unknown(),
      z.transform((val) => (typeof val === "string" ? val.trim() : val)),
    ),
    z.email("邮箱格式不正确"),
  ),

  /** 密码，仅要求非空（登录不做长度策略校验，错误统一报邮箱或密码错误） */
  password: z.string().check(z.minLength(1, "密码不能为空")),
});

/**
 * 修改密码字段校验 schema（不含两次输入一致性，一致性由 changePasswordSchema 补充）
 */
export const changePasswordFieldsSchema = z.object({
  /** 当前密码，仅要求非空，正确性由服务端校验 */
  currentPassword: z.string().check(z.minLength(1, "当前密码不能为空")),

  /** 新密码，6-128 位 */
  newPassword: passwordSchema,
});

/**
 * 完整修改密码校验 schema：在字段校验基础上追加业务约束——新密码不得与当前密码相同
 */
export const changePasswordSchema = changePasswordFieldsSchema.check(
  z.refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
    params: { rule: "passwordMismatch" },
  }),
);

/**
 * 更新个人资料校验 schema，全部字段可选，仅校验传入的字段
 */
export const updateProfileSchema = z.object({
  /** 名，可选，最长 50 字符 */
  firstName: z.optional(z.string().check(z.maxLength(50, "名不能超过50个字符"))),

  /** 姓，可选，最长 50 字符 */
  lastName: z.optional(z.string().check(z.maxLength(50, "姓不能超过50个字符"))),

  /** 头像 URL，可选，最长 500 字符，必须为空串或安全图片地址（https/站内路径） */
  avatar: optionalImageUrlSchema("头像URL", 500, IMAGE_URL_INVALID_MESSAGE),

  /** 个人简介，可选，最长 280 字符 */
  bio: z.optional(z.string().check(z.maxLength(280, "简介不能超过280个字符"))),

  /** 所在地，可选，最长 100 字符 */
  location: z.optional(z.string().check(z.maxLength(100, "所在地不能超过100个字符"))),

  /** 个人网站，可选，最长 200 字符，必须为空串或以 http(s):// 开头 */
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

/** 登录表单字段名集合 */
export type LoginField = "email" | "password";

/** 修改密码表单字段名集合（confirmPassword 仅存在于前端二次输入框） */
export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/** 资料编辑表单字段名集合 */
export type ProfileField = "firstName" | "lastName" | "avatar" | "bio" | "location" | "website";
