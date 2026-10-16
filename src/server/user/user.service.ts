import "server-only";

import { and, count, eq, or, sql } from "drizzle-orm";
import { joinName } from "@shared/format";
import type { User, UserPostAssociation, UserPostState, UserStatField } from "@shared";
import type { AtomicStatement } from "@server/common/db";
import { atomicBatch, getDb } from "@server/common/db";
import {
  userPostFavorites,
  userPostLikes,
  users,
  type UserInsert,
  type UserRow,
} from "@server/db/schema";

type UserWithAssociations = UserRow & {
  likedPosts: string[];
  favoritedPosts: string[];
};

const ASSOCIATION_TABLES = {
  likedPosts: userPostLikes,
  favoritedPosts: userPostFavorites,
} as const;

function mapToUser(row: UserWithAssociations): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    avatar: row.avatar,
    coverImage: row.coverImage,
    bio: row.bio,
    location: row.location,
    website: row.website,
    joined: row.joined.toISOString(),
    role: row.role,
    company: row.company,
    verified: row.verified,
    disabled: row.disabled,
    tags: row.tags,
    social: {
      twitter: row.socialTwitter,
      github: row.socialGithub,
      linkedin: row.socialLinkedin,
    },
    stats: {
      posts: row.statsArticles,
      likes: row.statsLikes,
      views: row.statsViews,
    },
    password: row.password ?? undefined,
    tokenVersion: row.tokenVersion,
    likedPosts: row.likedPosts,
    favoritedPosts: row.favoritedPosts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toUserValues(user: User): UserInsert {
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
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

function toUserSet(partial: Partial<User>) {
  return {
    ...(partial.firstName !== undefined && { firstName: partial.firstName }),
    ...(partial.lastName !== undefined && { lastName: partial.lastName }),
    ...(partial.avatar !== undefined && { avatar: partial.avatar }),
    ...(partial.coverImage !== undefined && { coverImage: partial.coverImage }),
    ...(partial.bio !== undefined && { bio: partial.bio }),
    ...(partial.location !== undefined && { location: partial.location }),
    ...(partial.website !== undefined && { website: partial.website }),
    ...(partial.username !== undefined && { username: partial.username }),
    ...(partial.role !== undefined && { role: partial.role }),
    ...(partial.company !== undefined && { company: partial.company }),
    ...(partial.verified !== undefined && { verified: partial.verified }),
    ...(partial.disabled !== undefined && { disabled: partial.disabled }),
    ...(partial.tags !== undefined && { tags: partial.tags }),
    ...(partial.password !== undefined && { password: partial.password }),
    ...(partial.tokenVersion !== undefined && { tokenVersion: partial.tokenVersion }),
    ...(partial.social?.twitter !== undefined && { socialTwitter: partial.social.twitter }),
    ...(partial.social?.github !== undefined && { socialGithub: partial.social.github }),
    ...(partial.social?.linkedin !== undefined && { socialLinkedin: partial.social.linkedin }),
    ...(partial.stats?.posts !== undefined && { statsArticles: partial.stats.posts }),
    ...(partial.stats?.likes !== undefined && { statsLikes: partial.stats.likes }),
    ...(partial.stats?.views !== undefined && { statsViews: partial.stats.views }),
    updatedAt: partial.updatedAt !== undefined ? new Date(partial.updatedAt) : new Date(),
  };
}

async function loadWithAssociations(id: string): Promise<UserWithAssociations | undefined> {
  const [userRow, liked, favorited] = await getDb().batch([
    getDb().select().from(users).where(eq(users.id, id)).limit(1),
    getDb()
      .select({ postId: userPostLikes.postId })
      .from(userPostLikes)
      .where(eq(userPostLikes.userId, id)),
    getDb()
      .select({ postId: userPostFavorites.postId })
      .from(userPostFavorites)
      .where(eq(userPostFavorites.userId, id)),
  ]);

  const row = userRow[0];
  if (!row) return undefined;
  return {
    ...row,
    likedPosts: liked.map((r) => r.postId),
    favoritedPosts: favorited.map((r) => r.postId),
  };
}

function insertUserAssociationsStmt(
  userId: string,
  association: UserPostAssociation,
  postIds: string[],
): AtomicStatement | undefined {
  if (postIds.length === 0) return undefined;
  const table = ASSOCIATION_TABLES[association];
  return getDb()
    .insert(table)
    .values(postIds.map((postId) => ({ userId, postId })))
    .onConflictDoNothing();
}

function statSet(field: UserStatField, delta: number) {
  switch (field) {
    case "posts":
      return { statsArticles: sql`${users.statsArticles} + ${delta}` };
    case "likes":
      return { statsLikes: sql`${users.statsLikes} + ${delta}` };
    case "views":
      return { statsViews: sql`${users.statsViews} + ${delta}` };
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ? mapToUser({ ...row, likedPosts: [], favoritedPosts: [] }) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return row ? mapToUser({ ...row, likedPosts: [], favoritedPosts: [] }) : undefined;
}

export async function getUserWithPostAssociations(id: string): Promise<User | undefined> {
  const row = await loadWithAssociations(id);
  return row ? mapToUser(row) : undefined;
}

export async function isEmailOrUsernameTaken(email: string, username: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)));
  return (row?.n ?? 0) > 0;
}

export function getUserDisplayName(
  user: Pick<User, "firstName" | "lastName" | "username">,
): string {
  return joinName(user.firstName, user.lastName) || user.username;
}

export async function createUser(user: User): Promise<User> {
  const statements = [
    getDb().insert(users).values(toUserValues(user)),
    insertUserAssociationsStmt(user.id, "likedPosts", user.likedPosts ?? []),
    insertUserAssociationsStmt(user.id, "favoritedPosts", user.favoritedPosts ?? []),
  ].filter((stmt): stmt is AtomicStatement => stmt !== undefined);

  await atomicBatch(statements);
  return user;
}

export async function updateUser(id: string, partial: Partial<User>): Promise<User | undefined> {
  const statements: AtomicStatement[] = [
    getDb().update(users).set(toUserSet(partial)).where(eq(users.id, id)).returning(),
  ];

  if (partial.likedPosts !== undefined) {
    statements.push(getDb().delete(userPostLikes).where(eq(userPostLikes.userId, id)));
    const insert = insertUserAssociationsStmt(id, "likedPosts", partial.likedPosts);
    if (insert) statements.push(insert);
  }
  if (partial.favoritedPosts !== undefined) {
    statements.push(getDb().delete(userPostFavorites).where(eq(userPostFavorites.userId, id)));
    const insert = insertUserAssociationsStmt(id, "favoritedPosts", partial.favoritedPosts);
    if (insert) statements.push(insert);
  }

  statements.push(
    getDb()
      .select({ postId: userPostLikes.postId })
      .from(userPostLikes)
      .where(eq(userPostLikes.userId, id)),
    getDb()
      .select({ postId: userPostFavorites.postId })
      .from(userPostFavorites)
      .where(eq(userPostFavorites.userId, id)),
  );

  const results = await atomicBatch(statements);
  const updated = results[0] as UserRow[];
  const row = updated[0];
  if (!row) return undefined;

  const liked = results[results.length - 2] as { postId: string }[];
  const favorited = results[results.length - 1] as { postId: string }[];
  return mapToUser({
    ...row,
    likedPosts: liked.map((r) => r.postId),
    favoritedPosts: favorited.map((r) => r.postId),
  });
}

export async function invalidateUserSessions(id: string): Promise<void> {
  await getDb().batch([
    getDb()
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, id)),
  ]);
}

export function incrementUserStatStmt(
  id: string,
  field: UserStatField,
  delta: number,
): AtomicStatement {
  return getDb().update(users).set(statSet(field, delta)).where(eq(users.id, id));
}

export async function getUserPostState(id: string, postId: string): Promise<UserPostState> {
  const [liked, favorited] = await getDb().batch([
    getDb()
      .select({ postId: userPostLikes.postId })
      .from(userPostLikes)
      .where(and(eq(userPostLikes.userId, id), eq(userPostLikes.postId, postId)))
      .limit(1),
    getDb()
      .select({ postId: userPostFavorites.postId })
      .from(userPostFavorites)
      .where(and(eq(userPostFavorites.userId, id), eq(userPostFavorites.postId, postId)))
      .limit(1),
  ]);
  return { liked: liked.length > 0, favorited: favorited.length > 0 };
}
