/**
 * @file user.repository.ts
 * @description 用户数据访问层。负责 User 领域模型与 Prisma 扁平列结构（驼峰列名拍平的
 * social/stats/appearance）的双向映射，提供按 id/email 查询、创建、部分更新、
 * tokenVersion 自增、统计字段原子增减及点赞/收藏关联的并发安全 toggle。
 */
import "server-only";
import type { User, UserStats } from "@shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@server/common/db";

/** 可执行数据库操作的客户端：普通实例或事务客户端 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Prisma User 行的扁平结构（social/stats/appearance 为拍平列，likedBy/favoritedBy 为关联查询结果）
 */
type PrismaUser = {
  id: string;

  email: string;

  firstName: string;

  lastName: string;

  username: string;

  avatar: string;

  coverImage: string;

  bio: string;

  location: string;

  website: string;

  joined: Date;

  role: string;

  company: string;

  verified: boolean;

  disabled: boolean;

  tags: string[];

  socialTwitter: string;

  socialGithub: string;

  socialLinkedin: string;

  /** 发文数统计 */
  statsArticles: number;

  /** 获赞数统计 */
  statsLikes: number;

  /** 浏览量统计 */
  statsViews: number;

  /** bcrypt 密码哈希，OAuth 等无密码账号为 null */
  password: string | null;

  /** 令牌版本号，自增使旧 JWT 全部失效 */
  tokenVersion: number;

  /** 界面主题偏好，未设置时为 null */
  appearanceTheme: string | null;

  /** 界面字号偏好，未设置时为 null */
  appearanceFontSize: string | null;

  createdAt: Date;

  updatedAt: Date;

  /** 该用户点赞的文章 id 列表（配合 userInclude 关联查询） */
  likedBy?: { postId: string }[];

  /** 该用户收藏的文章 id 列表（配合 userInclude 关联查询） */
  favoritedBy?: { postId: string }[];
};

/** 查询用户时附带点赞/收藏关联的 include 配置，用于填充 likedArticles/favoritedArticles */
export const userInclude = {
  likedBy: { select: { postId: true } },
  favoritedBy: { select: { postId: true } },
} as const;

/**
 * 将 Prisma 扁平行结构映射为前端 User 领域模型
 * 拍平列重组为 social/stats/appearance 嵌套对象，日期转 ISO 字符串
 * @param p Prisma 用户行（可含关联查询结果）
 * @returns User 领域模型
 */
export function mapToUser(p: PrismaUser): User {
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

/**
 * 将 User 领域模型反向映射为 Prisma 可写入的扁平 data 结构
 * 缺省字段填充空串/0/null 等列默认值
 * @param user User 领域模型
 * @returns Prisma create/update 的 data 对象
 */
export function mapToPrismaData(user: User) {
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
 * 按用户 id 查询
 * @param id 用户 id
 * @param opts.withAssociations 是否附带点赞/收藏关联
 * @returns User 领域模型，不存在时返回 undefined
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
 * 按邮箱查询用户
 * @param email 邮箱（调用方需保证大小写已归一）
 * @param opts.withAssociations 是否附带点赞/收藏关联
 * @returns User 领域模型，不存在时返回 undefined
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
 * 检查邮箱或用户名是否已被注册
 * @param email 邮箱
 * @param username 用户名
 * @returns 任一已存在即返回 true
 */
export async function existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
  const count = await getPrisma().user.count({
    where: { OR: [{ email }, { username }] },
  });
  return count > 0;
}

/**
 * 判断错误是否为 Prisma 唯一约束冲突（P2002），用于把并发注册冲突转为业务提示
 * @param err 捕获的未知错误
 * @returns 是否为唯一约束冲突
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
 * 创建用户，并在同一事务内恢复其已有点赞/收藏关联（skipDuplicates 防冲突）
 * @param user 待创建的 User 模型（可携带 likedArticles/favoritedArticles）
 * @returns 创建后的 User 模型（原样返回入参）
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
 * 按字段部分更新用户，在事务内完成
 * 仅显式传入的字段会被更新；likedArticles/favoritedArticles 传入时采用
 * 先清空再批量重建的替换策略；用户不存在时返回 undefined 而非抛错
 * @param id 用户 id
 * @param partial 待更新的字段集合
 * @returns 更新后的 User，用户不存在时返回 undefined
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
 * 用户令牌版本号自增，使该用户所有已签发 JWT 立即失效
 * 用于登出与修改密码场景（认证时校验载荷 tokenVersion 与库中一致）
 * @param id 用户 id
 */
export async function bumpTokenVersion(id: string): Promise<void> {
  await getPrisma().user.updateMany({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * 原子增减用户统计字段（发文数/获赞数/浏览量）
 * @param id 用户 id
 * @param field 统计字段名
 * @param delta 增量，可为负
 * @param tx 可选事务客户端，传入时操作并入外部事务
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
 * 原子切换用户对文章的点赞/收藏状态（并发安全）
 * 全程使用原子 SQL：先 DELETE 命中则取消关联；否则 INSERT（ON CONFLICT DO NOTHING）
 * 插入失败说明并发下已存在，回退再次 DELETE 保证 toggle 语义
 * @param id 用户 id
 * @param field 关联类型：点赞或收藏
 * @param postId 文章 id
 * @param tx 可选事务客户端，传入时操作并入外部事务
 * @returns true 表示此前已关联、本次已删除（取消）；false 表示此前未关联、本次已插入（新增）
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
 * 查询用户对某文章的点赞与收藏状态
 * @param id 用户 id
 * @param postId 文章 id
 * @returns 点赞与收藏的布尔状态
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
