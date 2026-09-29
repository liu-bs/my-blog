/**
 * @file en/auth.ts
 * @description 英文 - 登录 / 注册表单文案（标题、字段标签、按钮、校验与接口错误提示、密码强度），与 zh/auth.ts 逐 key 对应
 */
import type { Messages } from "../zh/auth";

const auth: Messages = {
  loginTitle: "Welcome back",
  loginSubtitle: "Sign in to write, comment & engage.",
  registerTitle: "Create an account",
  registerSubtitle: "Sign up to start writing.",
  /** 因未登录被重定向到登录页时，页面顶部的提示语 */
  redirectNotice: "Sign in to continue.",
  /** 姓名字段：英文名在前，对应中文包的「名」 */
  firstName: "First name",
  /** 姓名字段：英文姓在后，对应中文包的「姓」 */
  lastName: "Last name",
  username: "Username",
  /** 用户名字段的常态提示文案，与校验失败态 errUsername 文案相同但用途不同 */
  usernameHint: "Letters, numbers, underscores · 3–30 chars",
  email: "Email",
  password: "Password",
  /** 登录表单的密码占位符 */
  pwdPlaceholder: "Enter password",
  /** 注册表单的密码占位符，强调长度要求；与校验失败态 errPassword 区分 */
  pwdPlaceholderMin: "Min 6 characters",
  /** 登录表单提交按钮 */
  loginSubmit: "Sign in",
  /** 注册表单提交按钮 */
  registerSubmit: "Sign up",
  /** 忘记密码的说明入口，本项目不支持自助找回，引导联系管理员 */
  forgotPwd: "Forgot password? Contact admin",
  /** 登录接口被限流时的提示，需与后端限流窗口（5 分钟 5 次）保持一致 */
  rateLimit: "5 attempts per 5 minutes",
  /** 登录页底部提示语前半句，与 registerNow 组成一行 */
  noAccount: "No account?",
  /** 登录页底部跳转注册的链接，与 noAccount 配对 */
  registerNow: "Sign up →",
  /** 注册页底部提示语前半句，与 loginNow 组成一行 */
  hasAccount: "Have an account?",
  /** 注册页底部跳转登录的链接，与 hasAccount 配对 */
  loginNow: "Sign in →",
  /** 邮箱格式的客户端校验提示 */
  invalidEmail: "Invalid email",
  /** 密码为空的客户端校验提示 */
  emptyPwd: "Password required",
  /** 服务端返回的登录失败提示，出于安全不区分邮箱不存在与密码错误 */
  emailOrPwdError: "Incorrect email or password",
  /** 账号被禁用（tokenVersion 失效等）时的提示 */
  accountDisabled: "Account disabled",
  /** 注册时邮箱或用户名已存在的冲突提示 */
  duplicateAccount: "Email or username taken",
  /** 姓名长度校验失败提示 */
  errNameLength: "1–50 characters",
  /** 用户名校验失败提示，与常态提示 usernameHint 文案相同 */
  errUsername: "Letters, numbers, underscores · 3–30 chars",
  /** 密码长度校验失败提示，与注册占位符 pwdPlaceholderMin 口径一致 */
  errPassword: "At least 6 characters",
  /** 密码强度指示：弱 */
  strengthWeak: "Weak",
  /** 密码强度指示：中 */
  strengthMedium: "Medium",
  /** 密码强度指示：强 */
  strengthStrong: "Strong",
  /** 显示密码按钮的 aria-label（明文态） */
  showPassword: "Show password",
  /** 隐藏密码按钮的 aria-label（密文态） */
  hidePassword: "Hide password",
};

export default auth;
