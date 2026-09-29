/**
 * @file zh/settings.ts
 * @description 中文 - 账号设置页文案（资料页签、密码页签与各自的校验提示）
 */
const settings = {
  title: "账号设置",
  subtitle: "管理个人资料、密码与安全。",
  /** 资料页签文案 */
  tabProfile: "个人资料",
  /** 密码页签文案 */
  tabPassword: "修改密码",
  /** 姓名字段：中文「名」，与英文 First name 对应 */
  firstName: "名",
  /** 姓名字段：中文「姓」，与英文 Last name 对应 */
  lastName: "姓",
  /** 简介输入框的字数限制提示，需与后端校验上限一致 */
  bioHint: "最多 280 字符",
  avatarUrl: "头像链接",
  /** 头像链接的尺寸与形状建议 */
  avatarHint: "建议方形 256×256",

  /** 头像链接格式校验失败提示，与 write.coverInvalid 的校验口径一致 */
  avatarInvalid: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  bio: "个人简介",
  location: "所在地",
  website: "个人网站",
  /** 资料页签的提交按钮 */
  saveChanges: "保存修改",
  currentPwd: "当前密码",
  newPwd: "新密码",
  /** 新密码长度提示，需与后端校验下限一致 */
  newPwdHint: "至少 6 位",
  confirmPwd: "确认新密码",
  /** 密码页签的提交按钮，与资料页签的 saveChanges 区分 */
  updatePwd: "更新密码",
  /** 新密码过短的校验提示 */
  pwdTooShort: "新密码至少 6 位",
  /** 两次输入不一致的校验提示 */
  pwdMismatch: "两次密码不一致",
  /** 新旧密码相同的校验提示 */
  pwdSame: "新密码不能与当前密码相同",
  /** 服务端校验：当前密码错误 */
  pwdIncorrect: "当前密码不正确",
  /** 服务端校验：当前密码为空 */
  pwdRequired: "请输入当前密码",
  /** 个人网站链接格式校验提示，只接受完整 http(s) 地址 */
  websiteInvalid: "网站链接需以 http:// 或 https:// 开头",
};

export type Messages = typeof settings;
export default settings;
