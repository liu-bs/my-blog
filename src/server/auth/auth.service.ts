import "server-only";

import { randomUUID } from "node:crypto";

import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  SafeUser,
  UpdateProfileDto,
  User,
} from "@shared";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@server/common/errors";
import { isUniqueConstraintViolation } from "@server/common/db";
import { hashPassword, verifyPassword } from "@server/common/password";
import {
  createUser,
  getUserById,
  getUserByEmail,
  invalidateUserSessions,
  isEmailOrUsernameTaken,
  updateUser,
} from "@server/user/user.service";

const PLACEHOLDER_PASSWORD_HASH = "$2b$10$EEuWh8NBvDVQU0H3Nueyju/L/PkhwhtYGHTgoh92VnpGbaozrN6u.";

const DUPLICATE_ACCOUNT_MESSAGE = "Email or username already in use";

export const ACCOUNT_DISABLED_MESSAGE = "Account has been disabled";

export function toSafeUser(user: User): SafeUser {
  const {
    password: _password,
    tokenVersion: _tokenVersion,
    disabled: _disabled,
    ...safeUser
  } = user;
  return safeUser;
}

export async function register(dto: RegisterDto): Promise<User> {
  if (await isEmailOrUsernameTaken(dto.email, dto.username)) {
    throw new ConflictError(DUPLICATE_ACCOUNT_MESSAGE);
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: randomUUID(),
    ...dto,
    password: await hashPassword(dto.password),
    avatar: "",
    coverImage: "",
    bio: "",
    location: "",
    website: "",
    joined: now,
    role: "Writer",
    company: "",
    verified: false,
    disabled: false,
    tags: [],
    social: { twitter: "", github: "", linkedin: "" },
    stats: { posts: 0, likes: 0, views: 0 },
    tokenVersion: 0,
    appearance: { theme: "system", fontSize: "medium" },
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await createUser(newUser);
  } catch (err) {
    if (isUniqueConstraintViolation(err)) throw new ConflictError(DUPLICATE_ACCOUNT_MESSAGE);
    throw err;
  }
}

export async function login(dto: LoginDto): Promise<User> {
  const user = await getUserByEmail(dto.email);
  const isPasswordCorrect = await verifyPassword(
    dto.password,
    user?.password ?? PLACEHOLDER_PASSWORD_HASH,
  );
  if (!user || !isPasswordCorrect) {
    throw new UnauthorizedError("Email or password incorrect");
  }
  if (user.disabled) {
    throw new ForbiddenError(ACCOUNT_DISABLED_MESSAGE);
  }
  return user;
}

export async function getAccount(userId: string): Promise<User> {
  const user = await getUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export function logout(userId: string): Promise<void> {
  return invalidateUserSessions(userId);
}

export async function changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !(await verifyPassword(dto.currentPassword, user.password ?? ""))) {
    throw new UnauthorizedError("Current password incorrect");
  }
  await updateUser(userId, { password: await hashPassword(dto.newPassword) });
  await invalidateUserSessions(userId);
}

export async function updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
  const user = await getUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  const updated = await updateUser(userId, {
    firstName: dto.firstName !== undefined ? dto.firstName.trim() : user.firstName,
    lastName: dto.lastName !== undefined ? dto.lastName.trim() : user.lastName,
    avatar: dto.avatar ?? user.avatar,
    bio: dto.bio?.trim() ?? user.bio,
    location: dto.location !== undefined ? dto.location.trim() : user.location,
    website: dto.website !== undefined ? dto.website.trim() : user.website,
  });
  if (!updated) throw new NotFoundError("User not found");
  return updated;
}
