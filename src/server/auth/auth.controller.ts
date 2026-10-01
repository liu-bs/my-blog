"use server";

/**
 * @file auth.controller.ts
 * @description 认证模块 Server Action 控制器（"use server" 边界）。统一经 runAction 包装：
 * 登录/注册/改密前置 IP 与账号双维度限流，登出走 tokenVersion 吊销 + Cookie 清除，
 * 改密成功后清除本地 Cookie 强制重新登录；所有返回值均为 ActionResult 结构。
 */
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

/** 登录/注册/改密共用限流窗口：5 分钟 */
const LOGIN_WINDOW_MS = 5 * 60_000;

/** 命中限流时的通用提示文案 */
const TOO_MANY = "Too many attempts, please try again in 5 minutes";

/** 注册限流提示文案 */
const REGISTER_TOO_FREQUENT = "Registration too frequent, please try again in 5 minutes";

/**
 * 登录 Server Action
 * 双维度限流：IP 5 次/5 分钟 + 账号（邮箱）10 次/5 分钟；成功后签发认证 Cookie
 * @param input 登录表单数据
 * @returns ActionResult，成功携带脱敏用户
 */
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

/**
 * 注册 Server Action
 * 双维度限流：IP 与账号各 5 次/5 分钟；注册成功不自动登录，由前端引导登录
 * @param input 注册表单数据
 * @returns ActionResult，成功携带脱敏用户
 */
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

/**
 * 登出 Server Action
 * 已登录时自增 tokenVersion 吊销全部旧 token，并清除认证 Cookie；未登录也返回成功（幂等）
 * @returns ActionResult，data 恒为 null
 */
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

/**
 * 修改密码 Server Action
 * 需登录；账号维度限流 10 次/5 分钟；成功后 tokenVersion 自增并清除 Cookie 强制重新登录
 * @param input 改密表单数据
 * @returns ActionResult，data 恒为 null
 */
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

/**
 * 更新资料 Server Action，需登录；成功返回脱敏后的最新用户
 * @param input 资料表单数据
 * @returns ActionResult，成功携带脱敏用户
 */
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

/**
 * 查询当前登录用户信息 Server Action，需登录
 * @returns ActionResult，成功携带脱敏用户
 */
export async function getMeAction(): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    const user = await getMe(payload.id);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}
