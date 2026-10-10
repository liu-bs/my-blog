import "server-only";

import type { DbClient } from "@server/common/db";
import { joinName } from "@shared/format";
import type { User, UserPostAssociation, UserPostState, UserStatField } from "@shared";
import {
  countUsersByEmailOrUsername,
  createUserRecord,
  findUserByEmail,
  findUserById,
  findUserPostState,
  findUserWithPostAssociations,
  incrementTokenVersion,
  incrementUserStatColumn,
  toggleUserPostAssociationRecord,
  updateUserRecord,
} from "./user.repository";

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

export function incrementUserStat(
  id: string,
  field: UserStatField,
  delta: number,
  tx?: DbClient,
): Promise<void> {
  return incrementUserStatColumn(id, field, delta, tx);
}

export function toggleUserPostAssociation(
  userId: string,
  association: UserPostAssociation,
  postId: string,
  tx?: DbClient,
): Promise<boolean> {
  return toggleUserPostAssociationRecord(userId, association, postId, tx);
}

export function getUserPostState(userId: string, postId: string): Promise<UserPostState> {
  return findUserPostState(userId, postId);
}
