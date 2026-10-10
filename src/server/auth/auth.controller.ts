"use server";

import { cookies } from "next/headers";
import {
  toSafeUser,
  login,
  register,
  logout,
  changePassword,
  updateProfile,
  getMe,
} from "@server/auth/auth.service";
import { setAuthCookiesToJar, clearAuthCookiesFromJar } from "@server/auth/auth.cookie";
import {
  parseLoginBody,
  parseRegisterBody,
  parseChangePasswordBody,
  parseUpdateProfileBody,
} from "@server/auth/auth.validator";
import {
  runAction,
  requireAuthPayload,
  ensureNotRateLimited,
  clientIp,
  type ActionResult,
} from "@server/common/action-result";
import type { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto, SafeUser } from "@shared";

const LOGIN_WINDOW_MS = 5 * 60_000;

const TOO_MANY = "Too many attempts, please try again in 5 minutes";

const REGISTER_TOO_FREQUENT = "Registration too frequent, please try again in 5 minutes";

export async function loginAction(input: LoginDto): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    await ensureNotRateLimited(`login:${await clientIp()}`, 5, LOGIN_WINDOW_MS, TOO_MANY);
    const dto = parseLoginBody(input);

    await ensureNotRateLimited(
      `login:acct:${dto.email.toLowerCase()}`,
      10,
      LOGIN_WINDOW_MS,
      TOO_MANY,
    );

    const user = await login(dto);
    const jar = await cookies();
    setAuthCookiesToJar(jar, user);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function registerAction(
  input: RegisterDto,
): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async () => {
    await ensureNotRateLimited(
      `register:${await clientIp()}`,
      5,
      LOGIN_WINDOW_MS,
      REGISTER_TOO_FREQUENT,
    );
    const dto = parseRegisterBody(input);

    await ensureNotRateLimited(
      `register:acct:${dto.email.toLowerCase()}`,
      5,
      LOGIN_WINDOW_MS,
      REGISTER_TOO_FREQUENT,
    );

    const user = await register(dto);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function logoutAction(): Promise<ActionResult<null>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await authPayload();
    if (payload) {
      await logout(payload.id);
    }
    const jar = await cookies();
    clearAuthCookiesFromJar(jar);
    return { ok: true, data: null };
  });
}

export async function changePasswordAction(input: ChangePasswordDto): Promise<ActionResult<null>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    await ensureNotRateLimited(`pwd:acct:${payload.id}`, 10, LOGIN_WINDOW_MS, TOO_MANY);

    const dto = parseChangePasswordBody(input);
    await changePassword(payload.id, dto);

    const jar = await cookies();
    clearAuthCookiesFromJar(jar);

    return { ok: true, data: null };
  });
}

export async function updateProfileAction(
  input: UpdateProfileDto,
): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    const dto = parseUpdateProfileBody(input);
    const user = await updateProfile(payload.id, dto);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}

export async function getMeAction(): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    const user = await getMe(payload.id);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}
