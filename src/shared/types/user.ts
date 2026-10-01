/**
 * @file user.ts
 * @description 用户领域类型：用户完整实体（含敏感字段）、SafeUser 对外安全视图、
 *              认证载荷 AuthPayload 及注册/登录/改密/资料更新的 DTO
 */

/**
 * 用户完整实体（含敏感字段，仅服务端内部使用，禁止直接下发到客户端）
 */
export interface User {
  /** 用户唯一 ID */
  id: string;

  /** 登录邮箱 */
  email: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名，全局唯一 */
  username: string;

  /** 头像 URL，未设置时为空串 */
  avatar: string;

  /** 个人主页封面图 URL，未设置时为空串 */
  coverImage: string;

  /** 个人简介，未填写时为空串 */
  bio: string;

  /** 所在地，未填写时为空串 */
  location: string;

  /** 个人网站，未填写时为空串 */
  website: string;

  /** 注册时间，ISO 8601 字符串 */
  joined: string;

  /** 角色标识（如 writer/admin） */
  role: string;

  /** 公司/所属组织 */
  company: string;

  /** 是否已认证（展示认证徽标） */
  verified: boolean;

  /** 是否被禁用，禁用后无法登录 */
  disabled?: boolean;

  /** 兴趣标签列表 */
  tags: string[];

  /** 社交账号链接集合 {@link UserSocial} */
  social: UserSocial;

  /** 内容统计数据 {@link UserStats} */
  stats: UserStats;

  /** 密码哈希，仅服务端存在，任何对外视图都不得包含 */
  password?: string;

  /** 令牌版本号，修改密码/登出时递增使旧 token 失效 */
  tokenVersion?: number;

  /**
   * 外观偏好设置
   */
  appearance?: {
    /** 主题：亮色/暗色/跟随系统 */
    theme: "light" | "dark" | "system";

    /** 字号：小/中/大 */
    fontSize: "small" | "medium" | "large";
  };

  /** 已点赞文章 ID 列表 */
  likedArticles?: string[];

  /** 已收藏文章 ID 列表 */
  favoritedArticles?: string[];

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 用户社交账号链接集合
 */
interface UserSocial {
  /** Twitter/X 主页链接 */
  twitter: string;

  /** GitHub 主页链接 */
  github: string;

  /** LinkedIn 主页链接 */
  linkedin: string;
}

/**
 * 用户内容统计数据
 */
export interface UserStats {
  /** 发表文章数 */
  articles: number;

  /** 累计获赞数 */
  likes: number;

  /** 累计阅读量 */
  views: number;
}

/**
 * 注册入参 DTO
 */
export interface RegisterDto {
  /** 邮箱 */
  email: string;

  /** 明文密码，仅注册/登录请求传输，校验规则见 validation/auth.ts */
  password: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名 */
  username: string;
}

/**
 * 登录入参 DTO
 */
export interface LoginDto {
  /** 邮箱 */
  email: string;

  /** 明文密码 */
  password: string;
}

/**
 * 修改密码入参 DTO
 */
export interface ChangePasswordDto {
  /** 当前密码 */
  currentPassword: string;

  /** 新密码，6-128 位 */
  newPassword: string;
}

/**
 * 更新个人资料入参 DTO，全部字段可选，仅提交变更的字段
 */
export interface UpdateProfileDto {
  /** 名 */
  firstName?: string;

  /** 姓 */
  lastName?: string;

  /** 头像 URL，须通过安全图片校验（https 或站内路径） */
  avatar?: string;

  /** 个人简介，最长 280 字符 */
  bio?: string;

  /** 所在地 */
  location?: string;

  /** 个人网站，须以 http(s):// 开头 */
  website?: string;
}

/**
 * JWT 认证载荷：服务端从 token 解出的用户身份最小集合
 */
export interface AuthPayload {
  /** 用户唯一 ID */
  id: string;

  /** 签发时的令牌版本号，与用户当前 tokenVersion 比对判断 token 是否有效 */
  tokenVersion: number;

  /** 签发时间，Unix 秒级时间戳 */
  iat?: number;

  /** 过期时间，Unix 秒级时间戳 */
  exp?: number;
}

/**
 * 对外安全的用户视图：从 User 中剔除密码哈希、令牌版本、禁用标记及点赞/收藏记录等
 * 内部/敏感字段后，可安全下发到客户端的用户数据
 */
export type SafeUser = Omit<
  User,
  "password" | "tokenVersion" | "disabled" | "likedArticles" | "favoritedArticles"
>;
