import "server-only";

import type { User, UserPostAssociation, UserPostState, UserStatField } from "@shared";
import { Prisma } from "@prisma/client";
import { getPrisma, isRecordMissingError, type DbClient } from "@server/common/db";

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

  statsArticles: number;

  statsLikes: number;

  statsViews: number;

  password: string | null;

  tokenVersion: number;

  appearanceTheme: string | null;

  appearanceFontSize: string | null;

  createdAt: Date;

  updatedAt: Date;

  likedBy?: { postId: string }[];

  favoritedBy?: { postId: string }[];
};

const userInclude = {
  likedBy: { select: { postId: true } },
  favoritedBy: { select: { postId: true } },
} as const;

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
      posts: p.statsArticles,
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
    likedPosts: p.likedBy?.map((l) => l.postId) ?? [],
    favoritedPosts: p.favoritedBy?.map((f) => f.postId) ?? [],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

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
    statsArticles: user.stats?.posts ?? 0,
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

export async function findUserById(id: string): Promise<User | undefined> {
  const row = await getPrisma().user.findUnique({ where: { id } });
  return row ? mapToUser(row as unknown as PrismaUser) : undefined;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const row = await getPrisma().user.findUnique({ where: { email } });
  return row ? mapToUser(row as unknown as PrismaUser) : undefined;
}

export async function findUserWithPostAssociations(id: string): Promise<User | undefined> {
  const row = await getPrisma().user.findUnique({ where: { id }, include: userInclude });
  return row ? mapToUser(row as unknown as PrismaUser) : undefined;
}

export async function countUsersByEmailOrUsername(email: string, username: string): Promise<number> {
  return getPrisma().user.count({ where: { OR: [{ email }, { username }] } });
}

export async function createUserRecord(user: User): Promise<User> {
  const { likedPosts, favoritedPosts } = user;

  await getPrisma().$transaction(async (tx) => {
    await tx.user.create({ data: mapToPrismaData({ ...user }) });

    if (likedPosts && likedPosts.length > 0) {
      await tx.userPostLike.createMany({
        data: likedPosts.map((postId) => ({ userId: user.id, postId })),
        skipDuplicates: true,
      });
    }
    if (favoritedPosts && favoritedPosts.length > 0) {
      await tx.userPostFavorite.createMany({
        data: favoritedPosts.map((postId) => ({ userId: user.id, postId })),
        skipDuplicates: true,
      });
    }
  });

  return user;
}

export async function updateUserRecord(id: string, partial: Partial<User>): Promise<User | undefined> {
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
    if (partial.stats.posts !== undefined) data.statsArticles = partial.stats.posts;
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
      if (isRecordMissingError(err)) return undefined;
      throw err;
    }

    if (partial.likedPosts !== undefined) {
      await tx.userPostLike.deleteMany({ where: { userId: id } });
      if (partial.likedPosts.length > 0) {
        await tx.userPostLike.createMany({
          data: partial.likedPosts.map((postId) => ({ userId: id, postId })),
          skipDuplicates: true,
        });
      }
    }

    if (partial.favoritedPosts !== undefined) {
      await tx.userPostFavorite.deleteMany({ where: { userId: id } });
      if (partial.favoritedPosts.length > 0) {
        await tx.userPostFavorite.createMany({
          data: partial.favoritedPosts.map((postId) => ({ userId: id, postId })),
          skipDuplicates: true,
        });
      }
    }

    if (
      !updatedRow ||
      partial.likedPosts !== undefined ||
      partial.favoritedPosts !== undefined
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

export async function incrementTokenVersion(id: string): Promise<void> {
  await getPrisma().user.updateMany({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
}

export async function incrementUserStatColumn(
  id: string,
  field: UserStatField,
  delta: number,
  tx?: DbClient,
): Promise<void> {
  const fieldMap: Record<UserStatField, string> = {
    posts: "statsArticles",
    likes: "statsLikes",
    views: "statsViews",
  };
  const client = tx ?? getPrisma();
  await client.user.update({
    where: { id },
    data: { [fieldMap[field]]: { increment: delta } },
  });
}

export async function toggleUserPostAssociationRecord(
  id: string,
  association: UserPostAssociation,
  postId: string,
  tx?: DbClient,
): Promise<boolean> {
  const client = tx ?? getPrisma();
  const table =
    association === "likedPosts" ? Prisma.raw('"UserPostLike"') : Prisma.raw('"UserPostFavorite"');
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

export async function findUserPostState(
  id: string,
  postId: string,
): Promise<UserPostState> {
  const client = getPrisma();
  const key = { userId_postId: { userId: id, postId } } as const;
  const [like, favorite] = await Promise.all([
    client.userPostLike.findUnique({ where: key, select: { postId: true } }),
    client.userPostFavorite.findUnique({ where: key, select: { postId: true } }),
  ]);
  return { liked: !!like, favorited: !!favorite };
}
