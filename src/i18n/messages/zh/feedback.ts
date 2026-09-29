/**
 * @file zh/feedback.ts
 * @description 中文 - 全局操作反馈词表（toast、表单校验、接口错误映射）。
 * 本文件不走 next-intl，而是被 lib/message.ts 的 msg() 直接消费：占位符为简单的 {name},
 * 由 formatMsg 做字符串替换，不支持 ICU 复数 / 分支语法，改为逗号表达式会导致原样输出。
 * 结构以本文件为基准，英文包 en/feedback.ts 用 typeof 校验同构
 */
const feedback = {
  /** 通用错误提示，按 HTTP 状态码映射后选用 */
  common: {
    /** 4xx 类业务失败的通用提示 */
    actionFailed: "操作失败，请稍后重试",
    /** 未知异常 / 5xx 的兜底提示 */
    unknownError: "系统异常，请稍后重试",
    networkError: "网络异常，请检查网络后重试",
    timeout: "请求超时，请稍后重试",
    rateLimited: "操作过于频繁，请稍后再试",
    /** 401：令牌过期或 tokenVersion 失效，需重新登录 */
    sessionExpired: "登录已过期，请重新登录",
    /** 未登录（本地无 token）时的提示，与 sessionExpired 区分 */
    notLoggedIn: "请先登录后再操作",
    /** 403：已登录但无权限 */
    forbidden: "没有权限执行此操作",
    /** 404：资源不存在或已被删除 */
    contentGone: "内容不存在或已被删除",
    /** 兜底提示，{status} 为 HTTP 状态码占位符 */
    requestFailed: "请求失败（{status}）",
  },

  /** 新增类操作反馈，{entity} 由 entity 组的名词填充 */
  create: {
    success: "已新增{entity}",
    failed: "{entity}新增失败，请稍后重试",
  },

  /** 更新类操作反馈，{entity} 由 entity 组的名词填充 */
  update: {
    success: "已更新{entity}",
    failed: "{entity}更新失败，请稍后重试",
  },

  /** 删除类操作反馈，{entity} 由 entity 组的名词填充 */
  delete: {
    success: "已删除{entity}",
    failed: "{entity}删除失败，请稍后重试",
  },

  /** 点赞 / 收藏切换后的 toast，On 为激活、Off 为取消 */
  toggle: {
    likeOn: "已点赞",
    likeOff: "已取消点赞",
    favoriteOn: "已收藏",
    favoriteOff: "已取消收藏",
  },

  /** 账号会话相关反馈 */
  session: {
    loggedIn: "登录成功",
    loginFailed: "登录失败，请稍后重试",
    /** 注册成功后通常需跳转登录，故文案带引导 */
    registered: "注册成功，请登录",
    registerFailed: "注册失败，请重试",
    loggedOut: "已登出",
    logoutFailed: "登出失败，请重试",
    /** 改密会失效旧令牌，需提示重新登录 */
    passwordChanged: "密码修改成功，请重新登录",
  },

  /** 文章写作相关反馈 */
  post: {
    draftSaved: "草稿已保存",
    draftUpdated: "草稿已更新",
    /** 恢复本地未保存草稿时的提示 */
    draftRestored: "已恢复上次未保存的草稿",
    published: "文章已发布",
  },

  /** 表单校验提示，{field} 由 field 组的字段名填充，{min} / {max} 为长度阈值 */
  form: {
    /** 必填项缺失，{field} 为字段名 */
    requiredInput: "请输入{field}",
    /** 长度不足，{field} 为字段名，{min} 为最小字符数 */
    tooShort: "{field}至少 {min} 个字符",
    /** 长度超限，{field} 为字段名，{max} 为最大字符数 */
    tooLong: "{field}最多 {max} 个字符",
    /** 格式不合法，{field} 为字段名 */
    format: "{field}格式不正确",
    /** 新旧密码相同的校验提示，无占位符 */
    sameAsCurrent: "新密码不能与当前密码相同",
    /** 字段级校验无法定位到具体字段时的兜底提示 */
    invalidField: "该字段填写有误",
    /** 图片链接格式校验，与 settings.avatarInvalid 口径一致 */
    imageUrl: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  },

  /** 记录操作对象的名词，供 create / update / delete 的 {entity} 占位符使用 */
  entity: {
    post: "文章",
    comment: "评论",
    profile: "个人资料",
  },

  /** 字段名映射，供 form.* 的 {field} 占位符使用；key 为后端校验返回的字段路径 */
  field: {
    title: "标题",
    content: "正文",
    summary: "摘要",
    category: "分类",
    tags: "标签",
    coverImage: "封面图",
    email: "邮箱",
    password: "密码",
    currentPassword: "当前密码",
    newPassword: "新密码",
    firstName: "名",
    lastName: "姓",
    username: "用户名",
    avatar: "头像",
    bio: "简介",
    location: "所在地",
    website: "个人网站",
  },
};

export default feedback;
