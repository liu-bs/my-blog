/**
 * @file en/settings.ts
 * @description 英文 - 账号设置页文案（资料页签、密码页签与各自的校验提示），与 zh/settings.ts 逐 key 对应
 */
import type { Messages } from "../zh/settings";

const settings: Messages = {
  title: "Account settings",
  subtitle: "Manage profile, password & security.",
  /** 资料页签文案 */
  tabProfile: "Profile",
  /** 密码页签文案 */
  tabPassword: "Password",
  /** 姓名字段：与中文包的「名」对应 */
  firstName: "First name",
  /** 姓名字段：与中文包的「姓」对应 */
  lastName: "Last name",
  /** 简介输入框的字数限制提示，需与后端校验上限一致 */
  bioHint: "Up to 280 characters",
  avatarUrl: "Avatar URL",
  /** 头像链接的尺寸与形状建议 */
  avatarHint: "Square 256×256 recommended",

  /** 头像链接格式校验失败提示，与 write.coverInvalid 的校验口径一致 */
  avatarInvalid: "Enter an https image URL, or a site-relative /path",
  bio: "Bio",
  location: "Location",
  website: "Website",
  /** 资料页签的提交按钮 */
  saveChanges: "Save",
  currentPwd: "Current password",
  newPwd: "New password",
  /** 新密码长度提示，需与后端校验下限一致 */
  newPwdHint: "At least 6 characters",
  confirmPwd: "Confirm new password",
  /** 密码页签的提交按钮，与资料页签的 saveChanges 区分 */
  updatePwd: "Update",
  /** 新密码过短的校验提示 */
  pwdTooShort: "At least 6 characters",
  /** 两次输入不一致的校验提示 */
  pwdMismatch: "Passwords do not match",
  /** 新旧密码相同的校验提示 */
  pwdSame: "New password must differ from the current one",
  /** 服务端校验：当前密码错误 */
  pwdIncorrect: "Current password is incorrect",
  /** 服务端校验：当前密码为空 */
  pwdRequired: "Current password is required",
  /** 个人网站链接格式校验提示，只接受完整 http(s) 地址 */
  websiteInvalid: "Website must start with http:// or https://",
};

export default settings;
