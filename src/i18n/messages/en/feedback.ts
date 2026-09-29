/**
 * @file en/feedback.ts
 * @description 英文 - 全局操作反馈词表（toast、表单校验、接口错误映射），与 zh/feedback.ts 逐 key 同构。
 * 同样由 lib/message.ts 的 msg() 消费，占位符为简单的 {name}，不支持 ICU 语法
 */
import type feedback from "../zh/feedback";

const en: typeof feedback = {
  /** 通用错误提示，按 HTTP 状态码映射后选用 */
  common: {
    /** 4xx 类业务失败的通用提示 */
    actionFailed: "Action failed. Please try again.",
    /** 未知异常 / 5xx 的兜底提示 */
    unknownError: "Something went wrong. Please try again.",
    networkError: "Network error. Check your connection and try again.",
    timeout: "Request timed out. Please try again.",
    rateLimited: "Too many requests. Please try again later.",
    /** 401：令牌过期或 tokenVersion 失效，需重新登录 */
    sessionExpired: "Your session has expired. Please sign in again.",
    /** 未登录（本地无 token）时的提示，与 sessionExpired 区分 */
    notLoggedIn: "Please sign in first.",
    /** 403：已登录但无权限 */
    forbidden: "You do not have permission to do this.",
    /** 404：资源不存在或已被删除 */
    contentGone: "This content no longer exists.",
    /** 兜底提示，{status} 为 HTTP 状态码占位符 */
    requestFailed: "Request failed ({status})",
  },

  /** 新增类操作反馈，{entity} 由 entity 组的名词填充 */
  create: {
    success: "New {entity} created",
    failed: "Could not create the {entity}. Please try again.",
  },

  /** 更新类操作反馈，{entity} 由 entity 组的名词填充 */
  update: {
    success: "The {entity} has been updated",
    failed: "Could not update the {entity}. Please try again.",
  },

  /** 删除类操作反馈，{entity} 由 entity 组的名词填充 */
  delete: {
    success: "The {entity} has been deleted",
    failed: "Could not delete the {entity}. Please try again.",
  },

  /** 点赞 / 收藏切换后的 toast，On 为激活、Off 为取消 */
  toggle: {
    likeOn: "Liked",
    likeOff: "Unliked",
    favoriteOn: "Favorited",
    favoriteOff: "Unfavorited",
  },

  /** 账号会话相关反馈 */
  session: {
    loggedIn: "Signed in",
    loginFailed: "Sign in failed. Please try again.",
    /** 注册成功后通常需跳转登录，故文案带引导 */
    registered: "Account created — please sign in",
    registerFailed: "Sign up failed. Please try again.",
    loggedOut: "Signed out",
    logoutFailed: "Sign out failed. Please try again.",
    /** 改密会失效旧令牌，需提示重新登录 */
    passwordChanged: "Password updated — please sign in again",
  },

  /** 文章写作相关反馈 */
  post: {
    draftSaved: "Draft saved",
    draftUpdated: "Draft updated",
    /** 恢复本地未保存草稿时的提示 */
    draftRestored: "Restored your unsaved draft",
    published: "Post published",
  },

  /** 表单校验提示，{field} 由 field 组的字段名填充，{min} / {max} 为长度阈值 */
  form: {
    /** 必填项缺失，{field} 为字段名 */
    requiredInput: "Please enter {field}",
    /** 长度不足，{field} 为字段名，{min} 为最小字符数 */
    tooShort: "The {field} must be at least {min} characters",
    /** 长度超限，{field} 为字段名，{max} 为最大字符数 */
    tooLong: "The {field} must be at most {max} characters",
    /** 格式不合法，{field} 为字段名 */
    format: "Invalid {field} format",
    /** 新旧密码相同的校验提示，无占位符 */
    sameAsCurrent: "The new password must be different from the current one",
    /** 字段级校验无法定位到具体字段时的兜底提示 */
    invalidField: "This field is not valid",
    /** 图片链接格式校验，与 settings.avatarInvalid 口径一致 */
    imageUrl: "Enter an https image link, or a site path starting with /",
  },

  /** 记录操作对象的名词，供 create / update / delete 的 {entity} 占位符使用 */
  entity: {
    post: "post",
    comment: "comment",
    profile: "profile",
  },

  /** 字段名映射，供 form.* 的 {field} 占位符使用；key 为后端校验返回的字段路径 */
  field: {
    title: "title",
    content: "content",
    summary: "summary",
    category: "category",
    tags: "tags",
    coverImage: "cover image",
    email: "email",
    password: "password",
    currentPassword: "current password",
    newPassword: "new password",
    firstName: "first name",
    lastName: "last name",
    username: "username",
    avatar: "avatar",
    bio: "bio",
    location: "location",
    website: "website",
  },
};

export default en;
