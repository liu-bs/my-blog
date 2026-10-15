import "server-only";

import { joinName } from "@shared/format";
import type { User, UserPostState } from "@shared";
import {
  countUsersByEmailOrUsername,
  createUserRecord,
  findUserByEmail,
  findUserById,
  findUserPostState,
  findUserWithPostAssociations,
  incrementTokenVersion,
  updateUserRecord,
} from "./user.repository";

export { incrementUserStatStmt } from "./user.repository";

export function getUserById(id: string): Promise<User | undefined> {
  return findUserById(id);
}

export function getUserByEmail(email: string): Promise<User | undefined> {
  return findUserByEmail(email);
}

export function getUserWithPostAssociations(id: string): Promise<User | undefined> {
  return findUserWithPostAssociations(id);
}

export async function isEmailOrUsernameTaken(email: string, username: string): Promise<boolean> {
  return (await countUsersByEmailOrUsername(email, username)) > 0;
}

export function getUserDisplayName(
  user: Pick<User, "firstName" | "lastName" | "username">,
): string {
  return joinName(user.firstName, user.lastName) || user.username;
}

export function createUser(user: User): Promise<User> {
  return createUserRecord(user);
}

export function updateUser(id: string, partial: Partial<User>): Promise<User | undefined> {
  return updateUserRecord(id, partial);
}

export function invalidateUserSessions(id: string): Promise<void> {
  return incrementTokenVersion(id);
}

export function getUserPostState(userId: string, postId: string): Promise<UserPostState> {
  return findUserPostState(userId, postId);
}
