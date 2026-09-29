/**
 * @file user.ts
 * @description 用户领域的共享类型：用户实体（含服务端内部字段）、注册 / 登录 / 改密 / 改资料 DTO、
 *              JWT 载荷 AuthPayload，以及脱敏后的 SafeUser。
 * @warning {@link User} 同时承载服务端私有字段（password / tokenVersion 等），下发客户端前必须经 toSafeUser 脱敏
 */
export interface User {
  /** 用户唯一 ID（同时也是 JWT 载荷中的 sub） */
  id: string;

  /** 登录邮箱，全局唯一 */
  email: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名（唯一，展示与 @ 提及用） */
  username: string;

  /** 头像地址，可为空字符串表示未设置 */
  avatar: string;

  /** 个人主页封面图地址 */
  coverImage: string;

  /** 个人简介 */
  bio: string;

  /** 所在地 */
  location: string;

  /** 个人网站地址，需以 http(s):// 开头 */
  website: string;

  /** 入驻时间，ISO 8601 字符串（注册时写入，不随资料更新变化） */
  joined: string;

  /** 角色标识，注册默认为 "Writer"，用于服务端权限判断 */
  role: string;

  /** 所属公司 */
  company: string;

  /** 是否已通过认证（展示认证标识） */
  verified: boolean;

  /** 是否被禁用：为 true 时登录与鉴权会被拒绝 */
  disabled?: boolean;

  /** 个人标签 / 技能关键词列表 */
  tags: string[];

  /** 社交账号链接集合 */
  social: UserSocial;

  /** 个人统计数据（文章数 / 获赞 / 浏览量） */
  stats: UserStats;

  /** 密码哈希，仅服务端持久化与校验使用，绝不下发客户端 */
  password?: string;

  /** 令牌版本号，递增即可让该用户全部已签发 JWT 失效（全端登出 / 改密） */
  tokenVersion?: number;

  /** 外观偏好（主题与字号），用户未设置时为空 */
  appearance?: {
    /** 主题模式：跟随系统 / 亮 / 暗 */
    theme: "light" | "dark" | "system";

    /** 正文字号偏好 */
    fontSize: "small" | "medium" | "large";
  };

  /** 点赞过的文章 ID 列表，仅服务端判断点赞状态用，脱敏时剔除 */
  likedArticles?: string[];

  /** 收藏过的文章 ID 列表，仅服务端判断收藏状态用，脱敏时剔除 */
  favoritedArticles?: string[];

  /** 记录创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 记录最近更新时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 用户社交账号链接
 */
interface UserSocial {
  /** Twitter 主页链接，空字符串表示未填写 */
  twitter: string;

  /** GitHub 主页链接，空字符串表示未填写 */
  github: string;

  /** LinkedIn 主页链接，空字符串表示未填写 */
  linkedin: string;
}

/**
 * 用户统计信息
 * @description 由服务端聚合产出，用于个人主页展示，非实时精确值
 */
export interface UserStats {
  /** 发表的文章数 */
  articles: number;

  /** 累计获赞数 */
  likes: number;

  /** 累计浏览量 */
  views: number;
}

/**
 * 注册入参 DTO
 * @description 字段校验规则见 registerSchema
 */
export interface RegisterDto {
  /** 邮箱，需符合邮箱格式且未被注册 */
  email: string;

  /** 明文密码，服务端哈希后入库，不会回传 */
  password: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名，仅允许字母、数字、下划线 */
  username: string;
}

/**
 * 登录入参 DTO
 */
export interface LoginDto {
  /** 登录邮箱 */
  email: string;

  /** 明文密码，仅用于比对哈希 */
  password: string;
}

/**
 * 修改密码入参 DTO
 */
export interface ChangePasswordDto {
  /** 当前密码，用于二次校验身份 */
  currentPassword: string;

  /** 新密码，不能与当前密码相同 */
  newPassword: string;
}

/**
 * 更新资料入参 DTO
 * @description 全字段可选，仅提交需要修改的项；字段校验规则见 updateProfileSchema
 */
export interface UpdateProfileDto {
  /** 名 */
  firstName?: string;

  /** 姓 */
  lastName?: string;

  /** 头像地址，需为安全的图片 URL 或站内路径 */
  avatar?: string;

  /** 个人简介 */
  bio?: string;

  /** 所在地 */
  location?: string;

  /** 个人网站地址 */
  website?: string;
}

/**
 * JWT 令牌载荷
 * @description 令牌自包含这些字段；`tokenVersion` 与数据库比对用于实现令牌主动失效，
 *              `iat` / `exp` 由 JWT 库自动读写，业务代码无需赋值。
 */
export interface AuthPayload {
  /** 用户 ID */
  id: string;

  /** 签发时的令牌版本号，与库中不一致即视为已失效 */
  tokenVersion: number;

  /** 签发时间戳（秒），由 JWT 库自动填充 */
  iat?: number;

  /** 过期时间戳（秒），由 JWT 库自动填充 */
  exp?: number;
}

/**
 * 可安全下发客户端的用户
 * @description 从 {@link User} 剔除 password / tokenVersion / disabled 等敏感或内部字段，
 *              以及 likedArticles / favoritedArticles 两个仅服务端使用的关联列表
 */
export type SafeUser = Omit<
  User,
  "password" | "tokenVersion" | "disabled" | "likedArticles" | "favoritedArticles"
>;
