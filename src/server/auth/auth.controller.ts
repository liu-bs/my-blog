"use server";

/**
 * @file 认证域 Server Action 控制器
 * @description 登录/注册/登出/改密/资料/获取当前用户的服务端入口。
 * 薄编排层：限流 → 参数校验（auth.validator）→ 业务调用（auth.service）→ 读写认证 Cookie。
 * 仅由本应用 UI 通过 Server Action 调用，不对外提供 REST；错误统一经 runAction/toFailure 包装为 ActionResult。
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

/** 登录/注册/改密共用的限流时间窗口，单位ms（5分钟） */
const LOGIN_WINDOW_MS = 5 * 60_000;

/** 登录等操作触发限流时的用户提示文案 */
const TOO_MANY = "Too many attempts, please try again in 5 minutes";

/** 注册触发限流时的用户提示文案 */
const REGISTER_TOO_FREQUENT = "Registration too frequent, please try again in 5 minutes";

/**
 * 登录 Action
 * @description 按 IP（5次/5分钟）与账号邮箱（10次/5分钟）两级限流，成功后写入认证 Cookie。
 * 调用方 UI：src/components/auth/LoginForm.tsx
 * @param input 登录请求参数（邮箱 + 密码）
 * @returns 脱敏后的用户信息；失败时返回带 status/message 的 ActionResult
 * @throws 限流（429）、参数校验失败（400）、邮箱或密码错误（401）、账号被禁用（403）
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
 * 注册 Action
 * @description 按 IP（5次/5分钟）与邮箱（5次/5分钟）两级限流；成功后不落 Cookie，需前端再走登录流程。
 * 调用方 UI：src/components/auth/RegisterForm.tsx
 * @param input 注册请求参数（邮箱、密码、姓名、用户名）
 * @returns 新创建的脱敏用户信息
 * @throws 限流（429）、参数校验失败（400）、邮箱或用户名已被占用（409）
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
 * 登出 Action
 * @description 已登录时递增 tokenVersion 使旧 token 失效，随后清空认证 Cookie；未登录也直接清 Cookie，幂等。
 * 调用方 UI：src/hooks/useAuth.ts（供头部/侧边栏登出按钮使用）
 * @returns 恒为 { ok: true, data: null }
 * @throws 仅 Cookie 读取等基础设施异常时返回 500 包装结果
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
 * 修改密码 Action
 * @description 校验当前密码后写入新哈希，并递增 tokenVersion + 清 Cookie，强制所有端重新登录。
 * 调用方 UI：src/components/dashboard/SettingsForm.tsx
 * @param input 修改密码参数（当前密码 + 新密码）
 * @returns 成功时 data 为 null
 * @throws 未登录（401）、按用户 ID 限流 10 次/5 分钟（429）、参数校验失败（400）、当前密码错误（401）
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
 * 更新个人资料 Action
 * @description 只更新传入的字段；姓名/头像变更后会级联同步评论与文章作者名（见 auth.service.updateProfile）。
 * 调用方 UI：src/components/dashboard/SettingsForm.tsx
 * @param input 资料更新参数（均为可选字段的局部更新）
 * @returns 更新后的脱敏用户信息
 * @throws 未登录（401）、参数校验失败（400）、用户不存在（404）
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
 * 获取当前登录用户 Action
 * @description 供 AuthProvider 启动时恢复会话；payload 经 React cache 去重，同一次请求多次调用只解析一次。
 * 调用方 UI：src/components/AuthProvider.tsx
 * @returns 脱敏后的当前用户信息
 * @throws 未登录或 token 失效（401）、用户不存在（404）
 */
export async function getMeAction(): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    const user = await getMe(payload.id);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}
