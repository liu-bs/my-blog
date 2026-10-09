/**
 * @file user.ts
 * @description 用户域类型集合：用户完整实体、社交/统计子结构、注册/登录/改密/资料更新 DTO、
 *              JWT 载荷（{@link AuthPayload}）及面向前端的脱敏视图（{@link SafeUser}）。
 *              服务端 auth/user 域产出完整 {@link User}，对外（接口、Cookie 之外的响应）一律输出 {@link SafeUser}。
 */

/**
 * 用户完整实体（对应数据库 User 表，仅服务端内部使用）
 * @description 时间字段为 ISO 8601 字符串；多个字段允许空字符串表示"用户未填写"。
 *              含敏感字段（password、tokenVersion 等），返回给前端前必须剔除，见 {@link SafeUser}。
 */
export interface User {
  /** 用户唯一 ID */
  id: string;

  /** 登录邮箱，全局唯一 */
  email: string;

  /** 名（first name） */
  firstName: string;

  /** 姓（last name） */
  lastName: string;

  /** 用户名（展示用昵称标识） */
  username: string;

  /** 头像 URL，空字符串表示未设置（前端渲染首字母兜底） */
  avatar: string;

  /** 个人主页封面图 URL，空字符串表示未设置 */
  coverImage: string;

  /** 个人简介，空字符串表示未填写 */
  bio: string;

  /** 所在地区，空字符串表示未填写 */
  location: string;

  /** 个人网站 URL，空字符串表示未填写 */
  website: string;

  /** 注册时间，ISO 8601 字符串 */
  joined: string;

  /** 角色名称，新注册用户缺省为 "Writer" */
  role: string;

  /** 公司/组织名，空字符串表示未填写 */
  company: string;

  /** 账号是否已认证 */
  verified: boolean;

  /** 是否被禁用（封禁后无法登录）；缺省或 false 表示正常 */
  disabled?: boolean;

  /** 用户兴趣标签名列表 */
  tags: string[];

  /** 社交主页链接集合，见 {@link UserSocial} */
  social: UserSocial;

  /** 用户统计数据，见 {@link UserStats} */
  stats: UserStats;

  /** 密码哈希（bcrypt 等），仅服务端仓储层使用，严禁下发前端 */
  password?: string;

  /** Token 版本号：改密/全端登出时自增，与 JWT 内版本不一致的旧 token 全部失效；缺省视为 0 */
  tokenVersion?: number;

  /**
   * 个性化外观设置，未设置为 undefined 时前端跟随系统偏好
   * @description theme：light-浅色 / dark-深色 / system-跟随系统；
   *              fontSize：small-小 / medium-中 / large-大。
   */
  appearance?: {
    theme: "light" | "dark" | "system";

    fontSize: "small" | "medium" | "large";
  };

  /** 已点赞的文章 ID 列表，仅服务端互动逻辑使用，不下发前端 */
  likedArticles?: string[];

  /** 已收藏的文章 ID 列表，仅服务端互动逻辑使用，不下发前端 */
  favoritedArticles?: string[];

  /** 记录创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 记录最后更新时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 用户社交主页链接集合
 * @description 各字段为空字符串表示未填写。
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
 * 用户维度的统计数据
 */
export interface UserStats {
  /** 发布（含草稿）的文章总数 */
  articles: number;

  /** 其文章获得的累计点赞数 */
  likes: number;

  /** 其文章获得的累计浏览量 */
  views: number;
}

/**
 * 注册请求 DTO
 */
export interface RegisterDto {
  /** 登录邮箱，需符合邮箱格式且未被占用 */
  email: string;

  /** 明文密码，服务端校验强度后哈希存储 */
  password: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名，需唯一 */
  username: string;
}

/**
 * 登录请求 DTO
 */
export interface LoginDto {
  /** 登录邮箱 */
  email: string;

  /** 明文密码，服务端与存储的哈希比对 */
  password: string;
}

/**
 * 修改密码请求 DTO
 */
export interface ChangePasswordDto {
  /** 当前明文密码，校验通过后旧 token 依据 tokenVersion 失效 */
  currentPassword: string;

  /** 新明文密码，需满足强度要求 */
  newPassword: string;
}

/**
 * 更新个人资料请求 DTO（局部更新，缺省字段不改动）
 */
export interface UpdateProfileDto {
  /** 新名，缺省表示不修改 */
  firstName?: string;

  /** 新姓，缺省表示不修改 */
  lastName?: string;

  /** 新头像 URL，缺省表示不修改 */
  avatar?: string;

  /** 新个人简介，缺省表示不修改 */
  bio?: string;

  /** 新所在地区，缺省表示不修改 */
  location?: string;

  /** 新个人网站 URL，缺省表示不修改 */
  website?: string;
}

/**
 * JWT 载荷（认证 token 中携带的最小用户信息）
 * @description auth 域签发的 token 只含身份与版本号，不含敏感资料；
 *              服务端校验时会与数据库中该用户的 tokenVersion 比对。
 */
export interface AuthPayload {
  /** 用户 ID */
  id: string;

  /** 签发时的用户 token 版本号，用于失效旧 token */
  tokenVersion: number;

  /** JWT 标准字段 iat：签发时间，Unix 秒（非毫秒）；本地构造的 payload 可能缺省 */
  iat?: number;

  /** JWT 标准字段 exp：过期时间，Unix 秒（非毫秒）；缺省表示由校验层按其他策略判断有效期 */
  exp?: number;
}

/**
 * 面向前端的安全用户视图
 * @description {@link User} 去掉敏感字段（password、tokenVersion、disabled、likedArticles、favoritedArticles）后的类型，
 *              所有对外接口与 Server Action 均以此结构返回用户信息。
 */
export type SafeUser = Omit<
  User,
  "password" | "tokenVersion" | "disabled" | "likedArticles" | "favoritedArticles"
>;
