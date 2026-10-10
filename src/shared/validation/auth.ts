import { z } from "zod/mini";
import { optionalImageUrlSchema } from "./builders";
import { IMAGE_URL_INVALID_MESSAGE } from "./primitives";

const passwordSchema = z
  .string()
  .check(z.minLength(6, "密码长度不能少于6位"), z.maxLength(128, "密码长度不能超过128位"));

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

export const registerSchema = z.object({
  email: z.email("邮箱格式不正确"),

  password: passwordSchema,

  firstName: trimmed("昵称", 1, "昵称不能为空", 50),

  lastName: z.optional(trimmed("姓", 0, "姓不能为空", 50)),

  username: trimmed("用户名", 3, "用户名长度不能少于3位", 30).check(
    z.regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  ),
});

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

export const changePasswordFieldsSchema = z.object({
  currentPassword: z.string().check(z.minLength(1, "当前密码不能为空")),

  newPassword: passwordSchema,
});

export const changePasswordSchema = changePasswordFieldsSchema.check(
  z.refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
    params: { rule: "passwordMismatch" },
  }),
);

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

export type LoginField = "email" | "password";

export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";

export type ProfileField = "firstName" | "avatar" | "bio" | "location" | "website";
