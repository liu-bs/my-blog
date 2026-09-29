/**
 * @file zh/auth.ts
 * @description 中文 - 登录 / 注册表单文案（标题、字段标签、按钮、校验与接口错误提示、密码强度）
 */
const auth = {
  loginTitle: "欢迎回来",
  loginSubtitle: "登录以发布文章、评论与互动。",
  registerTitle: "创建账号",
  registerSubtitle: "注册即可开始写作与互动。",
  /** 因未登录被重定向到登录页时，页面顶部的提示语 */
  redirectNotice: "登录后继续访问",
  /** 姓名字段：中文「名」在前，与英文 First name 对应，勿与 lastName 混用 */
  firstName: "名",
  /** 姓名字段：中文「姓」在后，与英文 Last name 对应 */
  lastName: "姓",
  username: "用户名",
  /** 用户名字段的常态提示文案，与校验失败态 errUsername 文案相同但用途不同 */
  usernameHint: "字母、数字、下划线 · 3-30 字符",
  email: "邮箱",
  password: "密码",
  /** 登录表单的密码占位符 */
  pwdPlaceholder: "输入密码",
  /** 注册表单的密码占位符，强调长度要求；与校验失败态 errPassword 区分 */
  pwdPlaceholderMin: "至少 6 位",
  /** 登录表单提交按钮 */
  loginSubmit: "登录",
  /** 注册表单提交按钮 */
  registerSubmit: "注册",
  /** 忘记密码的说明入口，本项目不支持自助找回，引导联系管理员 */
  forgotPwd: "忘记密码？请联系管理员",
  /** 登录接口被限流时的提示，需与后端限流窗口（5 分钟 5 次）保持一致 */
  rateLimit: "5 分钟内最多 5 次",
  /** 登录页底部提示语前半句，与 registerNow 组成一行 */
  noAccount: "还没有账号？",
  /** 登录页底部跳转注册的链接，与 noAccount 配对 */
  registerNow: "立即注册 →",
  /** 注册页底部提示语前半句，与 loginNow 组成一行 */
  hasAccount: "已有账号？",
  /** 注册页底部跳转登录的链接，与 hasAccount 配对 */
  loginNow: "立即登录 →",
  /** 邮箱格式的客户端校验提示 */
  invalidEmail: "请输入有效邮箱",
  /** 密码为空的客户端校验提示 */
  emptyPwd: "请输入密码",
  /** 服务端返回的登录失败提示，出于安全不区分邮箱不存在与密码错误 */
  emailOrPwdError: "邮箱或密码错误",
  /** 账号被禁用（tokenVersion 失效等）时的提示 */
  accountDisabled: "账号已被禁用",
  /** 注册时邮箱或用户名已存在的冲突提示 */
  duplicateAccount: "邮箱或用户名已被注册",
  /** 姓名长度校验失败提示 */
  errNameLength: "1-50 个字符",
  /** 用户名校验失败提示，与常态提示 usernameHint 文案相同 */
  errUsername: "字母、数字、下划线 · 3-30 字符",
  /** 密码长度校验失败提示，与注册占位符 pwdPlaceholderMin 口径一致 */
  errPassword: "密码至少 6 位",
  /** 密码强度指示：弱 */
  strengthWeak: "密码强度：弱",
  /** 密码强度指示：中 */
  strengthMedium: "密码强度：中",
  /** 密码强度指示：强 */
  strengthStrong: "密码强度：强",
  /** 显示密码按钮的 aria-label（明文态） */
  showPassword: "显示密码",
  /** 隐藏密码按钮的 aria-label（密文态） */
  hidePassword: "隐藏密码",
};

export type Messages = typeof auth;
export default auth;
