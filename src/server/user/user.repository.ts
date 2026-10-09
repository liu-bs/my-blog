import "server-only";

/**
 * @file 用户域数据仓库层
 * @description 只负责 User 表及点赞/收藏关联表（UserPostLike/UserPostFavorite）的 Prisma 读写，
 * 并把扁平列（socialTwitter、statsArticles 等）映射回 shared User 的嵌套结构。
 * 认证业务在 auth.service、文章交互业务在 blog.service，本层不含业务判断；
 * 涉及关联表的写操作（createUser/updateUser/toggleUserAssociation）均自带或接收事务。
 */
import type { User, UserStats } from "@shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：可传全局 PrismaClient 或 $transaction 回调内的 tx */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * User 表扁平行结构（可选含点赞/收藏关联行，用于 withAssociations 查询）
 */
type PrismaUser = {
  /** 用户唯一ID */
  id: string;

  /** 登录邮箱（唯一） */
  email: string;

  /** 名 */
  firstName: string;

  /** 姓 */
  lastName: string;

  /** 用户名（唯一，展示兜底） */
  username: string;

  /** 头像 URL，空串表示未设置 */
  avatar: string;

  /** 个人主页封面图 URL */
  coverImage: string;

  /** 个人简介 */
  bio: string;

  /** 所在地 */
  location: string;

  /** 个人网站 */
  website: string;

  /** 加入时间 */
  joined: Date;

  /** 角色（如 Writer） */
  role: string;

  /** 公司 */
  company: string;

  /** 是否认证用户 */
  verified: boolean;

  /** 是否被禁用（禁用即拒绝登录与鉴权） */
  disabled: boolean;

  /** 用户标签数组 */
  tags: string[];

  /** 社交链接：Twitter */
  socialTwitter: string;

  /** 社交链接：GitHub */
  socialGithub: string;

  /** 社交链接：LinkedIn */
  socialLinkedin: string;

  /** 统计：已发布文章数 */
  statsArticles: number;

  /** 统计：文章累计被点赞数 */
  statsLikes: number;

  /** 统计：文章累计浏览量 */
  statsViews: number;

  /** bcrypt 密码哈希，可为 null（历史/第三方账号），绝不下发前端 */
  password: string | null;

  /** token 版本号：与 JWT 内版本不一致即失效，用于登出/改密强制下线 */
  tokenVersion: number;

  /** 主题偏好（light/dark/system），未设置为 null */
  appearanceTheme: string | null;

  /** 字号偏好（small/medium/large），未设置为 null */
  appearanceFontSize: string | null;

  /** 创建时间 */
  createdAt: Date;

  /** 最后更新时间 */
  updatedAt: Date;

  /** 关联：该用户点过赞的文章行（仅 withAssociations 查询时存在） */
  likedBy?: { postId: string }[];

  /** 关联：该用户收藏过的文章行（仅 withAssociations 查询时存在） */
  favoritedBy?: { postId: string }[];
};

/** 关联查询的 include 配置：只取 postId，避免拉整行文章 */
const userInclude = {
  likedBy: { select: { postId: true } },
  favoritedBy: { select: { postId: true } },
} as const;

/** 扁平行 → shared User：还原 social/stats/appearance 嵌套结构，Date 转 ISO，关联表转 postId 数组 */
function mapToUser(p: PrismaUser): User {
  return {
    id: p.id,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    username: p.username,
    avatar: p.avatar,
    coverImage: p.coverImage,
    bio: p.bio,
    location: p.location,
    website: p.website,
    joined: p.joined.toISOString(),
    role: p.role,
    company: p.company,
    verified: p.verified,
    disabled: p.disabled,
    tags: p.tags,
    social: {
      twitter: p.socialTwitter,
      github: p.socialGithub,
      linkedin: p.socialLinkedin,
    },
    stats: {
      articles: p.statsArticles,
      likes: p.statsLikes,
      views: p.statsViews,
    },
    password: p.password ?? undefined,
    tokenVersion: p.tokenVersion,
    appearance:
      p.appearanceTheme && p.appearanceFontSize
        ? {
            theme: p.appearanceTheme as "light" | "dark" | "system",
            fontSize: p.appearanceFontSize as "small" | "medium" | "large",
          }
        : undefined,
    likedArticles: p.likedBy?.map((l) => l.postId) ?? [],
    favoritedArticles: p.favoritedBy?.map((f) => f.postId) ?? [],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** shared User → Prisma 扁平创建数据：嵌套字段拍平，缺省值统一兜底（注意 likedArticles 等关联由调用方单独处理） */
function mapToPrismaData(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar ?? "",
    coverImage: user.coverImage ?? "",
    bio: user.bio ?? "",
    location: user.location ?? "",
    website: user.website ?? "",
    joined: new Date(user.joined),
    role: user.role ?? "Writer",
    company: user.company ?? "",
    verified: user.verified ?? false,
    disabled: user.disabled ?? false,
    tags: user.tags ?? [],
    socialTwitter: user.social?.twitter ?? "",
    socialGithub: user.social?.github ?? "",
    socialLinkedin: user.social?.linkedin ?? "",
    statsArticles: user.stats?.articles ?? 0,
    statsLikes: user.stats?.likes ?? 0,
    statsViews: user.stats?.views ?? 0,
    password: user.password ?? null,
    tokenVersion: user.tokenVersion ?? 0,
    appearanceTheme: user.appearance?.theme ?? null,
    appearanceFontSize: user.appearance?.fontSize ?? null,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

/**
 * 按 ID 查询用户
 * @param id 用户 ID
 * @param opts withAssociations=true 时附带点赞/收藏的 postId 列表（收藏页/状态判断用）
 * @returns 完整 User（含 password 哈希，调用方负责脱敏）；不存在时 undefined
 */
export async function findUserById(
  id: string,
  opts?: { withAssociations?: boolean },
): Promise<User | undefined> {
  const row = await getPrisma().user.findUnique({
    where: { id },
    ...(opts?.withAssociations ? { include: userInclude } : {}),
  });
  return row ? mapToUser(row as unknown as PrismaUser) : undefined;
}

/**
 * 按邮箱查询用户（登录入口用；邮箱已在 validator 归一为小写）
 * @param email 邮箱
 * @param opts withAssociations 同 findUserById
 * @returns 完整 User；不存在时 undefined
 */
export async function findUserByEmail(
  email: string,
  opts?: { withAssociations?: boolean },
): Promise<User | undefined> {
  const row = await getPrisma().user.findUnique({
    where: { email },
    ...(opts?.withAssociations ? { include: userInclude } : {}),
  });
  return row ? mapToUser(row as unknown as PrismaUser) : undefined;
}

/**
 * 注册查重：邮箱或用户名任一命中即视为已占用
 * @param email 邮箱（已小写归一）
 * @param username 用户名
 * @returns 是否存在冲突记录
 */
export async function existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
  const count = await getPrisma().user.count({
    where: { OR: [{ email }, { username }] },
  });
  return count > 0;
}

/**
 * 判断是否为 Prisma 唯一约束冲突（P2002），供 service 层转成 409 而非 500
 * @param err 未知异常
 * @returns 是否唯一键冲突
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * 创建用户及其点赞/收藏关联（迁移/导入场景可携带已有互动数据）
 * @param user 完整 User
 * @returns 传入的 user 原样返回
 * @warning 主表与关联表在同一事务内写入；关联写入 skipDuplicates，重复互动静默跳过
 */
export async function createUser(user: User): Promise<User> {
  const { likedArticles, favoritedArticles } = user;

  await getPrisma().$transaction(async (tx) => {
    await tx.user.create({ data: mapToPrismaData({ ...user }) });

    if (likedArticles && likedArticles.length > 0) {
      await tx.userPostLike.createMany({
        data: likedArticles.map((postId) => ({ userId: user.id, postId })),
        skipDuplicates: true,
      });
    }
    if (favoritedArticles && favoritedArticles.length > 0) {
      await tx.userPostFavorite.createMany({
        data: favoritedArticles.map((postId) => ({ userId: user.id, postId })),
        skipDuplicates: true,
      });
    }
  });

  return user;
}

/**
 * 更新用户（PATCH 语义：undefined 字段跳过；嵌套的 social/stats/appearance 逐子字段合并）
 * @param id 用户 ID
 * @param partial 需要更新的字段子集；likedArticles/favoritedArticles 传入即整表替换（先删后插）
 * @returns 更新后的完整 User；用户不存在（P2025）时 undefined
 * @warning 主表更新与关联表重建在同一事务内；updatedAt 缺省自动盖当前时间
 */
export async function updateUser(id: string, partial: Partial<User>): Promise<User | undefined> {
  const data: Record<string, unknown> = {};

  if (partial.firstName !== undefined) data.firstName = partial.firstName;
  if (partial.lastName !== undefined) data.lastName = partial.lastName;
  if (partial.avatar !== undefined) data.avatar = partial.avatar;
  if (partial.coverImage !== undefined) data.coverImage = partial.coverImage;
  if (partial.bio !== undefined) data.bio = partial.bio;
  if (partial.location !== undefined) data.location = partial.location;
  if (partial.website !== undefined) data.website = partial.website;
  if (partial.username !== undefined) data.username = partial.username;
  if (partial.role !== undefined) data.role = partial.role;
  if (partial.company !== undefined) data.company = partial.company;
  if (partial.verified !== undefined) data.verified = partial.verified;
  if (partial.disabled !== undefined) data.disabled = partial.disabled;
  if (partial.tags !== undefined) data.tags = partial.tags;
  if (partial.password !== undefined) data.password = partial.password;
  if (partial.tokenVersion !== undefined) data.tokenVersion = partial.tokenVersion;

  data.updatedAt = partial.updatedAt !== undefined ? new Date(partial.updatedAt) : new Date();

  if (partial.social) {
    if (partial.social.twitter !== undefined) data.socialTwitter = partial.social.twitter;
    if (partial.social.github !== undefined) data.socialGithub = partial.social.github;
    if (partial.social.linkedin !== undefined) data.socialLinkedin = partial.social.linkedin;
  }

  if (partial.stats) {
    if (partial.stats.articles !== undefined) data.statsArticles = partial.stats.articles;
    if (partial.stats.likes !== undefined) data.statsLikes = partial.stats.likes;
    if (partial.stats.views !== undefined) data.statsViews = partial.stats.views;
  }

  if (partial.appearance) {
    data.appearanceTheme = partial.appearance.theme;
    data.appearanceFontSize = partial.appearance.fontSize;
  }

  return getPrisma().$transaction(async (tx) => {
    let updatedRow: PrismaUser | null = null;

    try {
      if (Object.keys(data).length > 0) {
        updatedRow = (await tx.user.update({
          where: { id },
          data,
          include: userInclude,
        })) as unknown as PrismaUser;
      }
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && err.code === "P2025") return undefined;
      throw err;
    }

    // 关联列表传入即整表替换：先清空旧关联再批量重建，保证与传入数组完全一致
    if (partial.likedArticles !== undefined) {
      await tx.userPostLike.deleteMany({ where: { userId: id } });
      if (partial.likedArticles.length > 0) {
        await tx.userPostLike.createMany({
          data: partial.likedArticles.map((postId) => ({ userId: id, postId })),
          skipDuplicates: true,
        });
      }
    }

    if (partial.favoritedArticles !== undefined) {
      await tx.userPostFavorite.deleteMany({ where: { userId: id } });
      if (partial.favoritedArticles.length > 0) {
        await tx.userPostFavorite.createMany({
          data: partial.favoritedArticles.map((postId) => ({ userId: id, postId })),
          skipDuplicates: true,
        });
      }
    }

    // 关联表被改动或无可更新列时，需重查一次拿到最新关联数据再映射
    if (
      !updatedRow ||
      partial.likedArticles !== undefined ||
      partial.favoritedArticles !== undefined
    ) {
      const row = await tx.user.findUnique({
        where: { id },
        include: userInclude,
      });
      return row ? mapToUser(row as unknown as PrismaUser) : undefined;
    }

    return updatedRow ? mapToUser(updatedRow) : undefined;
  });
}

/**
 * 递增 tokenVersion：登出/改密后使该用户此前签发的所有 JWT 立即失效（服务端强制下线手段）
 * @param id 用户 ID
 */
export async function bumpTokenVersion(id: string): Promise<void> {
  await getPrisma().user.updateMany({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * 原子增减用户统计（articles/likes/views，映射到 statsArticles 等扁平列）
 * @param id 用户 ID
 * @param field 统计字段名（UserStats 的键）
 * @param delta 增量，可为负数
 * @param tx 可选事务客户端；与文章计数联动时必传
 */
export async function incrementUserStats(
  id: string,
  field: keyof UserStats,
  delta: number,
  tx?: Tx,
): Promise<void> {
  const fieldMap: Record<keyof UserStats, string> = {
    articles: "statsArticles",
    likes: "statsLikes",
    views: "statsViews",
  };
  const client = tx ?? getPrisma();
  await client.user.update({
    where: { id },
    data: { [fieldMap[field]]: { increment: delta } },
  });
}

/**
 * 切换用户与文章的点赞/收藏关联（存在则删、不存在则插，原子判定）
 * @param id 用户 ID
 * @param field 关联类型：likedArticles 对应 UserPostLike 表，favoritedArticles 对应 UserPostFavorite 表
 * @param postId 文章 ID
 * @param tx 可选事务客户端；与文章计数联动时必传
 * @returns 切换前是否已存在关联（true=本次是取消）
 * @warning 走原生 SQL 以单语句完成"删除或插入"；并发下 ON CONFLICT 兜底后补一次删除，保证切换语义
 */
export async function toggleUserAssociation(
  id: string,
  field: "likedArticles" | "favoritedArticles",
  postId: string,
  tx?: Tx,
): Promise<boolean> {
  const client = tx ?? getPrisma();
  const table =
    field === "likedArticles" ? Prisma.raw('"UserPostLike"') : Prisma.raw('"UserPostFavorite"');
  const key = Prisma.sql`"userId" = ${id} AND "postId" = ${postId}`;

  // 三步走：先删（存在→取消）；删不到就插入（新增互动）；
  // 插入也影响 0 行说明并发下刚被他人删插，兜底再删一次并判定为"取消"
  const deleted = await client.$executeRaw`DELETE FROM ${table} WHERE ${key}`;
  if (deleted > 0) return true;

  const inserted = await client.$executeRaw`
    INSERT INTO ${table} ("userId", "postId") VALUES (${id}, ${postId})
    ON CONFLICT DO NOTHING`;
  if (inserted > 0) return false;

  await client.$executeRaw`DELETE FROM ${table} WHERE ${key}`;
  return true;
}

/**
 * 查询用户对单篇文章的点赞/收藏状态（两次主键点查，命中联合唯一索引）
 * @param id 用户 ID
 * @param postId 文章 ID
 * @returns { liked, favorited } 布尔状态
 */
export async function findUserPostState(
  id: string,
  postId: string,
): Promise<{ liked: boolean; favorited: boolean }> {
  const client = getPrisma();
  const key = { userId_postId: { userId: id, postId } } as const;
  const [like, favorite] = await Promise.all([
    client.userPostLike.findUnique({ where: key, select: { postId: true } }),
    client.userPostFavorite.findUnique({ where: key, select: { postId: true } }),
  ]);
  return { liked: !!like, favorited: !!favorite };
}
