/**
 * @file auth.ts
 * @description 登录/注册页（src/app/(auth)/login、register）文案集合：
 * 表单标签、占位符、前后端校验错误与密码强度提示。
 * 经 @/texts 的 messages.auth 命名空间消费（LoginForm、RegisterForm、PasswordStrength、PasswordToggle 等）。
 */

/** 登录/注册页文案集合 */
const auth = {
  /** 登录页主标题 */
  loginTitle: "欢迎回来",
  /** 登录页标题下方辅助说明 */
  loginSubtitle: "登录后可以写作与评论。",
  /** 注册页主标题 */
  registerTitle: "创建账号",
  /** 注册页标题下方辅助说明 */
  registerSubtitle: "注册后即可写作与评论。",

  /** 登录页顶部提示：存在 redirect 参数时说明登录后将返回原页面（proxy 重定向带入） */
  redirectNotice: "登录后继续访问",

  /** 注册表单昵称字段标签 */
  firstName: "昵称",
  /** 昵称输入框占位符 */
  firstNamePlaceholder: "怎么称呼你",

  /** 注册表单用户名字段标签 */
  username: "用户名",
  /** 用户名输入框示例占位符 */
  usernamePlaceholder: "your_name",

  /** 注册表单用户名输入框下方的格式提示 */
  usernameHint: "字母、数字、下划线 · 3-30 字符", // 与注册表单的 usernameHint 分开，登录时不需要提示格式。
  /** 邮箱字段标签（登录、注册表单共用） */
  email: "邮箱",
  /** 密码字段标签（登录、注册表单共用） */
  password: "密码",

  /** 登录页密码输入框占位符 */
  pwdPlaceholder: "输入密码",

  /** 注册页密码输入框占位符 */
  pwdPlaceholderMin: "至少 6 位",

  /** 注册页密码输入框下方强度建议提示 */
  passwordHint: "至少 6 位，建议混合大小写与符号",

  /** 登录表单提交按钮文案 */
  loginSubmit: "登录",

  /** 注册表单提交按钮文案 */
  registerSubmit: "注册",

  /** 登录页底部引导文案 */
  noAccount: "还没有账号？",

  /** 登录页跳注册页的链接文案 */
  registerNow: "立即注册 →",

  /** 注册页底部引导文案 */
  hasAccount: "已有账号？",

  /** 注册页跳登录页的链接文案 */
  loginNow: "立即登录 →",

  /** 邮箱格式前端校验错误提示 */
  invalidEmail: "请输入有效邮箱",

  /** 密码为空时前端校验错误提示 */
  emptyPwd: "请输入密码",

  /** 登录接口返回凭据无效时的页面错误提示 */
  emailOrPwdError: "邮箱或密码错误",

  /** 登录接口返回账号被禁用时的页面错误提示 */
  accountDisabled: "账号已被禁用",

  /** 注册时邮箱或用户名已被占用的错误提示 */
  duplicateAccount: "邮箱或用户名已被注册",

  /** 昵称长度校验错误（1-50 字符） */
  errNameLength: "1-50 个字符",

  /** 用户名格式校验错误 */
  errUsername: "字母、数字、下划线 · 3-30 字符",

  /** 密码长度校验错误 */
  errPassword: "密码至少 6 位",

  /** PasswordStrength 组件：弱强度提示 */
  strengthWeak: "密码强度：弱",

  /** PasswordStrength 组件：中等强度提示 */
  strengthMedium: "密码强度：中",

  /** PasswordStrength 组件：高强度提示 */
  strengthStrong: "密码强度：强",

  /** PasswordToggle 显示密码按钮的无障碍标签 */
  showPassword: "显示密码",

  /** PasswordToggle 隐藏密码按钮的无障碍标签 */
  hidePassword: "隐藏密码",
};

/** 登录/注册页文案默认导出 */
export default auth;
