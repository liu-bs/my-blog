/**
 * @file auth.ts
 * @description 认证与用户资料领域的校验 schema：注册、登录、修改密码、更新资料，以及表单字段名类型。
 *              服务端 Validator 与前端表单（即时校验）共用同一份规则，保证两侧边界值一致。
 */
import { z } from "zod/mini";
import { optionalImageUrlSchema } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

/**
 * 新密码通用规则
 * @description 长度 6–128：下限保证基本强度，上限避免超长输入拖慢 bcrypt 哈希计算（防哈希炸弹）
 */
const passwordSchema = z
  .string()
  .check(z.minLength(6, "密码长度不能少于6位"), z.maxLength(128, "密码长度不能超过128位"));

/**
 * 构造「先 trim 再校验长度」的字符串 schema
 * @description 用 z.unknown 兜底再 transform：入参来自表单 / JSON，可能不是字符串，
 *              先对上层的非法类型原样透传给 z.string() 统一报类型错误，避免在 trim 处抛异常。
 *              下限文案单独由 minMsg 指定，是为了让「不能为空」与「长度不足」区分开。
 * @param field 字段中文名，用于拼接超长提示
 * @param min 最小长度（通常为 1，表示非空）
 * @param minMsg 长度不足时的提示文案
 * @param max 最大长度
 * @returns 去空白并按长度约束校验的字符串 schema
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
 * 注册入参校验
 * @description 邮箱需符合邮箱格式；用户名限 3–30 位且仅允许字母、数字、下划线（避免生成奇怪的 @ 提及与 URL）
 */
export const registerSchema = z.object({
  email: z.email("邮箱格式不正确"),

  password: passwordSchema,

  firstName: trimmed("名", 1, "名不能为空", 50),

  lastName: trimmed("姓", 1, "姓不能为空", 50),

  username: trimmed("用户名", 3, "用户名长度不能少于3位", 30).check(
    z.regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  ),
});

/**
 * 登录入参校验
 * @description 邮箱先 trim 再校验格式，避免用户粘贴时带入空格导致误判；
 *              密码只要求非空而不校验复杂度，以免规则收紧后存量用户无法登录
 */
export const loginSchema = z.object({
  email: z.pipe(
    z.pipe(
      z.unknown(),
      z.transform((val) => (typeof val === "string" ? val.trim() : val)),
    ),
    z.email("邮箱格式不正确"),
  ),

  password: z.string().check(z.minLength(1, "密码不能为空")),
});

/**
 * 修改密码的字段级校验
 * @description 只描述单个字段的约束，供前端表单直接复用以做即时校验；
 *              跨字段（新旧密码是否相同）的规则在 {@link changePasswordSchema} 上追加
 */
export const changePasswordFieldsSchema = z.object({
  currentPassword: z.string().check(z.minLength(1, "当前密码不能为空")),

  newPassword: passwordSchema,
});

/**
 * 修改密码完整校验
 * @description 在字段校验基础上追加跨字段 refine：新密码不得与当前密码相同；
 *              错误定位到 newPassword 并带 rule = "passwordMismatch"，前端据此展示本地化文案
 */
export const changePasswordSchema = changePasswordFieldsSchema.check(
  z.refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
    params: { rule: "passwordMismatch" },
  }),
);

/**
 * 更新资料入参校验
 * @description 全字段可选（PATCH 语义，只提交要改的字段）：
 *              avatar 走安全的图片 URL 规则，website 限 200 字符且必须以 http:// 或 https:// 开头（空串表示清空）。
 */
export const updateProfileSchema = z.object({
  firstName: z.optional(z.string().check(z.maxLength(50, "名不能超过50个字符"))),

  lastName: z.optional(z.string().check(z.maxLength(50, "姓不能超过50个字符"))),

  avatar: optionalImageUrlSchema("头像URL", 500, IMAGE_URL_INVALID_MESSAGE),

  bio: z.optional(z.string().check(z.maxLength(280, "简介不能超过280个字符"))),

  location: z.optional(z.string().check(z.maxLength(100, "所在地不能超过100个字符"))),

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

/**
 * 登录表单字段名
 */
export type LoginField = "email" | "password";

/**
 * 修改密码表单字段名
 * @description 含 confirmPassword：该字段只在前端做两次输入一致性校验，不参与服务端 schema
 */
export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/**
 * 更新资料表单字段名
 */
export type ProfileField = "firstName" | "lastName" | "avatar" | "bio" | "location" | "website";
