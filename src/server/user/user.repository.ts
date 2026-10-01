/**
 * @file user.repository.ts
 * @description 用户领域的数据访问层，负责 User 表与点赞/收藏关联表的 Prisma 读写，并在 Prisma 行结构（扁平、Date 类型）与领域对象 User（嵌套、ISO 字符串）之间做映射
 * @warning 本文件不承载业务规则，仅做数据访问与结构转换；鉴权、脱敏等逻辑在 auth.service
 */
import "server-only";
import type { User, UserStats } from "@shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@server/common/db";

/** 事务客户端类型：既接受 PrismaClient，也接受 $transaction 回调里传入的 tx 句柄，便于仓储方法在事务内外复用 */
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * User 表在 Prisma 中的行结构
 * @description 与领域对象 User 的差异：社交/统计/外观字段是扁平列（socialTwitter、statsArticles 等）而非嵌套对象，
 * likedBy/favoritedBy 仅在 include 关联时存在
 */
type PrismaUser = {
  /** 主键，UUID */
  id: string;
  /** 登录邮箱，全局唯一，统一存小写 */
  email: string;
  /** 名 */
  firstName: string;
  /** 姓 */
  lastName: string;
  /** 用户名，全局唯一，用于展示 */
  username: string;
  /** 头像 URL，空串表示未设置 */
  avatar: string;
  /** 个人主页封面图 URL */
  coverImage: string;
  /** 个人简介 */
  bio: string;
  /** 所在地 */
  location: string;
  /** 个人网站 URL */
  website: string;
  /** 注册时间 */
  joined: Date;
  /** 角色，默认 Writer */
  role: string;
  /** 所属公司 */
  company: string;
  /** 是否已认证作者 */
  verified: boolean;
  /** 是否被禁用，禁用后禁止登录 */
  disabled: boolean;
  /** 兴趣标签列表 */
  tags: string[];
  /** 社交账号：Twitter */
  socialTwitter: string;
  /** 社交账号：GitHub */
  socialGithub: string;
  /** 社交账号：LinkedIn */
  socialLinkedin: string;
  /** 统计：发表文章数 */
  statsArticles: number;
  /** 统计：获赞数 */
  statsLikes: number;
  /** 统计：文章浏览量 */
  statsViews: number;
  /** bcrypt 密码哈希，允许为空（如第三方登录用户） */
  password: string | null;
  /** 令牌版本号，递增即让该用户所有已签发 JWT 失效 */
  tokenVersion: number;
  /** 外观主题偏好，为空表示未自定义 */
  appearanceTheme: string | null;
  /** 外观字号偏好，为空表示未自定义 */
  appearanceFontSize: string | null;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 关联：该用户点赞过的文章（仅 select postId），需 include 才存在 */
  likedBy?: { postId: string }[];
  /** 关联：该用户收藏过的文章（仅 select postId），需 include 才存在 */
  favoritedBy?: { postId: string }[];
};

/**
 * 查询用户时携带点赞/收藏关联的 include 片段
 * @description 只取 postId，避免把整篇 Post 拉回来；供需要 likedArticles / favoritedArticles 的场景复用
 */
export const userInclude = {
  likedBy: { select: { postId: true } },
  favoritedBy: { select: { postId: true } },
} as const;

/**
 * Prisma 行 → 领域对象 User
 * @description 把扁平列还原为嵌套的 social/stats/appearance；Date 统一转 ISO 字符串；可选关联缺失时按空数组处理；
 * password 为空时转为 undefined（领域对象约定可选），appearance 仅在主题与字号都存在时才组装
 * @param p PrismaUser 行（可能带有 include 的关联）
 * @returns 领域层 User 对象
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
 * 领域对象 User → Prisma 可写入的数据
 * @description 反向映射：嵌套 social/stats/appearance 拆回扁平列；字符串与布尔/数字字段在缺省时补齐默认值（NULL 列除外，appearance 缺省写 null）；
 * joined/createdAt/updatedAt 由 ISO 字符串转回 Date
 * @param user 领域层用户对象
 * @returns 可直接用于 Prisma create/update 的字段对象
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
 * 按 id 查用户
 * @param id 用户 id
 * @param opts.withAssociations 为 true 时一并加载 likedArticles / favoritedArticles 关联
 * @returns 用户对象，不存在返回 undefined
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
 * 按邮箱查用户（登录主路径）
 * @param email 邮箱，调用方需保证已转小写
 * @param opts.withAssociations 为 true 时一并加载点赞/收藏关联
 * @returns 用户对象，不存在返回 undefined
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
 * 判断邮箱或用户名是否已被占用
 * @param email 邮箱
 * @param username 用户名
 * @returns 任一命中即返回 true
 */
export async function existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
  const count = await getPrisma().user.count({
    where: { OR: [{ email }, { username }] },
  });
  return count > 0;
}

/**
 * 判断错误是否为 Prisma 唯一约束冲突
 * @description P2002 表示唯一索引冲突，用于并发注册时兜底转成业务层的 ConflictError
 * @param err 捕获到的异常
 * @returns 是唯一约束冲突返回 true
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
 * 创建用户
 * @description 在同一事务内先写 User 主表，再按需批量写入点赞（UserPostLike）与收藏（UserPostFavorite）关联；
 * skipDuplicates 避免重复关联报错
 * @param user 待创建的用户对象，likedArticles / favoritedArticles 为初始关联
 * @returns 入参用户对象本身（关联表写入不影响主对象字段）
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
 * 局部更新用户
 * @description 仅对显式传入（!== undefined）的字段生成 update data，未传字段保持库中原值；
 * 注意 appearance 是整体替换语义，缺省值会写入 null；
 * likedArticles / favoritedArticles 传入时按「全量替换」处理（先 deleteMany 再 createMany），因此只有确实要改关联时才应传入
 * @param id 用户 id
 * @param partial 待更新的字段集合
 * @returns 更新后的用户对象；用户不存在（Prisma P2025）时返回 undefined
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
 * 递增用户的令牌版本号
 * @description tokenVersion 与 JWT 载荷中的值比对即可让旧令牌整体失效，用于登出、改密等「全端下线」场景；
 * 用 updateMany 而非 update，使其在用户已不存在时静默成功、不抛异常
 * @param id 用户 id
 */
export async function bumpTokenVersion(id: string): Promise<void> {
  await getPrisma().user.updateMany({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * 递增用户统计计数（原子自增，避免读改写竞态）
 * @param id 用户 id
 * @param field 统计维度：articles（文章数）/ likes（获赞数）/ views（浏览量）
 * @param delta 增量，可为负数用于回退（如删除文章）
 * @param tx 可选事务句柄；传入时复用同一事务，保证与主操作原子
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
 * 切换用户与文章的点赞/收藏关联（存在则取消，不存在则建立）
 * @description 用原生 SQL 串起「先试删、删不到再插、插入撞唯一约束则再删」三步，配合 ON CONFLICT DO NOTHING 在并发下也能收敛到确定状态；
 * 表名来自白名单分支而非拼接用户输入，值统一走参数化，规避 SQL 注入
 * @param id 用户 id
 * @param field 关联类型：likedArticles 对应 UserPostLike 表，favoritedArticles 对应 UserPostFavorite 表
 * @param postId 文章 id
 * @param tx 可选事务句柄
 * @returns wasPresent 语义：true 表示本次调用「之前已存在关联」（本次实际执行的是取消），false 表示之前不存在（本次为新增）。调用方（blog.service）据此换算点赞/收藏的最终状态并计算计数增量
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
 * 查询某用户对某篇文章的点赞/收藏状态
 * @description 关联表以 (userId, postId) 复合主键唯一标识，故用复合唯一键查询；两条查询并行执行
 * @param id 用户 id
 * @param postId 文章 id
 * @returns liked / favorited 分别表示是否已点赞、已收藏
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
