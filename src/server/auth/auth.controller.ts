"use server";

import { cookies } from "next/headers";

import type {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  UpdateProfileDto,
  SafeUser,
  User,
} from "@shared";
import {
  clientIp,
  ensureNotRateLimited,
  runAction,
  type ActionResult,
} from "@server/common/action-result";
import { logger } from "@server/common/logger";
import { RATE_LIMITS } from "@server/common/policy";
import { getAuthPayload, requireAuthPayload } from "@server/auth/auth.guard";
import { clearAuthCookiesOnStore, setAuthCookiesOnStore } from "./auth.cookie";
import {
  changePassword,
  getAccount,
  login,
  logout,
  register,
  toSafeUser,
  updateProfile,
} from "./auth.service";
import { invalidateCommentsCache } from "@server/comment/comment.cache";
import { updateCommentsAuthorProfile } from "@server/comment/comment.service";
import {
  invalidatePostCache,
  revalidatePostListPaths,
  revalidatePostPath,
} from "@server/post/post.cache";
import { updatePostsAuthorName } from "@server/post/post.service";
import { getUserDisplayName } from "@server/user/user.service";
import {
  parseChangePasswordBody,
  parseLoginBody,
  parseRegisterBody,
  parseUpdateProfileBody,
} from "./auth.validator";

async function syncAuthorDisplay(user: User): Promise<void> {
  const displayName = getUserDisplayName(user);
  try {
    const commentedPostIds = await updateCommentsAuthorProfile(
      user.id,
      displayName,
      user.avatar || null,
    );
    const ownedPostIds = await updatePostsAuthorName(user.id, displayName);

    const affectedPostIds = new Set([...commentedPostIds, ...ownedPostIds]);
    for (const postId of affectedPostIds) {
      invalidatePostCache(postId);
      invalidateCommentsCache(postId);
      revalidatePostPath(postId);
    }
    revalidatePostListPaths();
  } catch (err: unknown) {
    logger.error("Failed to sync author display name", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function loginAction(input: LoginDto): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    await ensureNotRateLimited(`login:${await clientIp()}`, RATE_LIMITS.loginByIp);
    const dto = parseLoginBody(input);

    await ensureNotRateLimited(`login:acct:${dto.email.toLowerCase()}`, RATE_LIMITS.loginByAccount);

    const user = await login(dto);
    setAuthCookiesOnStore(await cookies(), user);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function registerAction(
  input: RegisterDto,
): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    await ensureNotRateLimited(`register:${await clientIp()}`, RATE_LIMITS.registerByIp);
    const dto = parseRegisterBody(input);

    await ensureNotRateLimited(
      `register:acct:${dto.email.toLowerCase()}`,
      RATE_LIMITS.registerByAccount,
    );

    const user = await register(dto);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function logoutAction(): Promise<ActionResult<null>> {
  return runAction("Auth", async () => {
    const viewer = await getAuthPayload();
    if (viewer) await logout(viewer.id);

    clearAuthCookiesOnStore(await cookies());
    return { ok: true, data: null };
  });
}

export async function changePasswordAction(input: ChangePasswordDto): Promise<ActionResult<null>> {
  return runAction("Auth", async () => {
    const viewer = await requireAuthPayload();
    await ensureNotRateLimited(`pwd:acct:${viewer.id}`, RATE_LIMITS.passwordChangeByAccount);

    const dto = parseChangePasswordBody(input);
    await changePassword(viewer.id, dto);

    clearAuthCookiesOnStore(await cookies());
    return { ok: true, data: null };
  });
}

export async function updateProfileAction(
  input: UpdateProfileDto,
): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    const viewer = await requireAuthPayload();

    const dto = parseUpdateProfileBody(input);
    const user = await updateProfile(viewer.id, dto);
    await syncAuthorDisplay(user);

    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function getMeAction(): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    const viewer = await requireAuthPayload();
    const user = await getAccount(viewer.id);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}
