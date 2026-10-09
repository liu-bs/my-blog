/**
 * @file settings.ts
 * @description 账号设置页（src/app/(dashboard)/settings，SettingsForm.tsx）文案：
 * 个人资料表单、修改密码表单的标签、提示与校验错误，经 messages.settings 消费。
 */

/** 账号设置页文案集合 */
const settings = {
  /** 设置页主标题 */
  title: "账号设置",
  /** 设置页副标题 */
  subtitle: "管理个人资料、密码与安全。",

  /** 分组标签：个人资料表单 */
  tabProfile: "个人资料",

  /** 分组标签：修改密码表单 */
  tabPassword: "修改密码",

  /** 昵称输入字段标签 */
  firstName: "昵称",

  /** 头像链接输入字段标签 */
  avatarUrl: "头像链接",

  /** 头像输入框下方尺寸建议 */
  avatarHint: "建议方形 256×256",

  /** 头像链接格式校验错误（与 feedback.form.imageUrl 文案一致） */
  avatarInvalid: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  /** 个人简介输入字段标签 */
  bio: "个人简介",
  /** 所在地输入字段标签 */
  location: "所在地",
  /** 个人网站输入字段标签 */
  website: "个人网站",

  /** 个人资料表单的提交按钮 */
  saveChanges: "保存修改",
  /** 改密表单：当前密码字段标签 */
  currentPwd: "当前密码",
  /** 改密表单：新密码字段标签 */
  newPwd: "新密码",

  /** 新密码输入框下方长度提示 */
  newPwdHint: "至少 6 位",
  /** 改密表单：确认新密码字段标签 */
  confirmPwd: "确认新密码",

  /** 改密表单的提交按钮 */
  updatePwd: "更新密码",

  /** 校验错误：新密码不足 6 位 */
  pwdTooShort: "新密码至少 6 位",

  /** 校验错误：两次输入的新密码不一致 */
  pwdMismatch: "两次密码不一致",

  /** 校验错误：新密码与当前密码相同 */
  pwdSame: "新密码不能与当前密码相同",

  /** 校验错误：服务端返回当前密码不正确 */
  pwdIncorrect: "当前密码不正确",

  /** 校验错误：当前密码为空 */
  pwdRequired: "请输入当前密码",

  /** 校验错误：个人网站链接缺少 http/https 协议前缀 */
  websiteInvalid: "网站链接需以 http:// 或 https:// 开头",
};

/** 账号设置页文案默认导出 */
export default settings;
