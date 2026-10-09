/**
 * @file feedback.ts
 * @description 操作反馈文案集合：toast 提示、CRUD/登录态变更结果、表单校验错误模板。
 * 主要消费方为 src/lib/toast.ts、src/lib/message.ts、src/lib/apiRequest.ts、src/lib/formFeedback.ts
 * 及各表单/交互组件；含 {xxx} 占位的模板需配合 formatTemplate 插值。
 */

/** 操作反馈文案集合 */
const feedback = {
  /** 通用异常反馈：由 apiRequest/toast 按错误类型选择 */
  common: {
    /** 未知操作失败的 toast 兜底文案 */
    actionFailed: "操作失败，请稍后重试",

    /** 服务端 5xx 等系统异常的 toast 文案 */
    unknownError: "系统异常，请稍后重试",
    /** 请求无响应/网络错误时的 toast 文案 */
    networkError: "网络异常，请检查网络后重试",
    /** 请求超时时的 toast 文案 */
    timeout: "请求超时，请稍后重试",
    /** 触发限流（429）时的 toast 文案 */
    rateLimited: "操作过于频繁，请稍后再试",

    /** 登录态失效（401）时的 toast 文案 */
    sessionExpired: "登录已过期，请重新登录",

    /** 未登录用户执行受限操作时的 toast 文案 */
    notLoggedIn: "请先登录后再操作",

    /** 已登录但权限不足（403）时的 toast 文案 */
    forbidden: "没有权限执行此操作",

    /** 目标内容已被删除或不存在（404）时的 toast 文案 */
    contentGone: "内容不存在或已被删除",

    /** 其他 HTTP 状态码的兜底文案，{status} 为状态码 */
    requestFailed: "请求失败（{status}）",
  },

  /** 新增操作反馈，{entity} 由 entity 命名空间插值 */
  create: {
    /** 新增成功的 toast 文案 */
    success: "已新增{entity}",
    /** 新增失败的 toast 文案 */
    failed: "{entity}新增失败，请稍后重试",
  },

  /** 更新操作反馈，{entity} 由 entity 命名空间插值 */
  update: {
    /** 更新成功的 toast 文案 */
    success: "已更新{entity}",
    /** 更新失败的 toast 文案 */
    failed: "{entity}更新失败，请稍后重试",
  },

  /** 删除操作反馈，{entity} 由 entity 命名空间插值 */
  delete: {
    /** 删除成功的 toast 文案 */
    success: "已删除{entity}",
    /** 删除失败的 toast 文案 */
    failed: "{entity}删除失败，请稍后重试",
  },

  /** 点赞/收藏切换按钮（PostActions）的即时反馈文案 */
  toggle: {
    /** 点赞成功 */
    likeOn: "已点赞",
    /** 取消点赞 */
    likeOff: "已取消点赞",
    /** 收藏成功 */
    favoriteOn: "已收藏",
    /** 取消收藏 */
    favoriteOff: "已取消收藏",
  },

  /** 登录态与账号操作（登录/注册/登出/改密）的反馈文案 */
  session: {
    /** 登录成功 toast */
    loggedIn: "登录成功",
    /** 登录请求失败 toast */
    loginFailed: "登录失败，请稍后重试",

    /** 注册成功后引导登录的 toast */
    registered: "注册成功，请登录",
    /** 注册失败 toast */
    registerFailed: "注册失败，请重试",
    /** 登出成功 toast（配合 useLogoutRedirect 跳转） */
    loggedOut: "已登出",
    /** 登出失败 toast */
    logoutFailed: "登出失败，请重试",

    /** 修改密码成功后引导重新登录的 toast */
    passwordChanged: "密码修改成功，请重新登录",
  },

  /** 写作页（WriteEditor）草稿与发布相关反馈文案 */
  post: {
    /** 新建草稿保存成功 toast */
    draftSaved: "草稿已保存",
    /** 已有草稿更新成功 toast */
    draftUpdated: "草稿已更新",

    /** 进入编辑器时恢复了本地暂存草稿的提示 */
    draftRestored: "已恢复上次未保存的草稿",
    /** 文章发布成功 toast */
    published: "文章已发布",
  },

  /** 表单字段校验错误模板，{field}/{min}/{max} 由 field 命名空间及规则插值（formFeedback） */
  form: {
    /** 必填项为空 */
    requiredInput: "请输入{field}",

    /** 长度/数值小于最小值 */
    tooShort: "{field}至少 {min} 个字符",

    /** 长度/数值超过最大值 */
    tooLong: "{field}最多 {max} 个字符",

    /** 格式不符合规则（邮箱、URL 等） */
    format: "{field}格式不正确",

    /** 修改密码时新旧密码相同的错误 */
    sameAsCurrent: "新密码不能与当前密码相同",

    /** 无法定位具体规则时的字段级兜底错误 */
    invalidField: "该字段填写有误",

    /** 图片类 URL 字段（头像/封面）的格式错误 */
    imageUrl: "请填写以 https 开头的图片链接，或以 / 开头的站内路径",
  },

  /** 实体名词字典：用于 create/update/delete 模板的 {entity} 插值 */
  entity: {
    /** 文章实体 */
    post: "文章",
    /** 评论实体 */
    comment: "评论",
    /** 个人资料实体 */
    profile: "个人资料",
  },

  /** 字段名词字典：用于 form 校验模板的 {field} 插值 */
  field: {
    /** 文章标题字段 */
    title: "标题",
    /** 文章正文字段 */
    content: "正文",
    /** 文章摘要字段 */
    summary: "摘要",
    /** 文章分类字段 */
    category: "分类",
    /** 文章标签字段 */
    tags: "标签",
    /** 文章封面图字段 */
    coverImage: "封面图",
    /** 注册/登录邮箱字段 */
    email: "邮箱",
    /** 密码字段 */
    password: "密码",
    /** 改密表单当前密码字段 */
    currentPassword: "当前密码",
    /** 改密表单新密码字段 */
    newPassword: "新密码",
    /** 用户名的名字部分 */
    firstName: "名",
    /** 用户名的姓氏部分 */
    lastName: "姓",
    /** 用户名字段 */
    username: "用户名",
    /** 头像字段 */
    avatar: "头像",
    /** 简介字段 */
    bio: "简介",
    /** 所在地字段 */
    location: "所在地",
    /** 个人网站字段 */
    website: "个人网站",
  },
};

/** 操作反馈文案默认导出 */
export default feedback;
