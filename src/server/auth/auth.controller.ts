/**
 * @file auth.controller.ts
 * @description 认证领域的 Server Action 编排层：串联限流、入参校验、业务服务与 cookie 写入，统一以 ActionResult 返回结果
 * @warning 文件首行 "use server" 使其所有导出函数都成为可从客户端调用的 Server Action，因此每个 action 都必须自行做鉴权与限流
 */
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

/** 登录/注册类动作的限流时间窗口，单位毫秒（5 分钟） */
const LOGIN_WINDOW_MS = 5 * 60_000;
/** 限流命中时返回给用户的中文提示（登录/改密共用） */
const TOO_MANY = "Too many attempts, please try again in 5 minutes";
/** 注册限流命中时的提示（与登录区分，便于前端归因） */
const REGISTER_TOO_FREQUENT = "Registration too frequent, please try again in 5 minutes";

/**
 * 登录
 * @description 做双层限流：先按客户端 IP（5 次/5 分钟）挡住泛洪，再按邮箱（10 次/5 分钟）挡住针对单账号的撞库；
 * 校验通过后写认证 cookie，并只返回脱敏的 SafeUser
 * @param input 登录入参（邮箱、密码）
 * @returns 成功时 data 为脱敏用户信息
 * @throws RateLimitError 超过任一限流阈值时
 * @throws UnauthorizedError 邮箱或密码错误时
 * @throws ForbiddenError 账号被禁用时
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
 * 注册
 * @description 与登录一致的双层限流（IP 5 次、账号维度 5 次，均为 5 分钟）；注册不自动登录，需用户随后手动登录
 * @param input 注册入参（邮箱、密码、名、姓、用户名）
 * @returns 成功时 data 为脱敏用户信息
 * @throws RateLimitError 超过限流阈值时
 * @throws ConflictError 邮箱或用户名已被占用时
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
 * 登出
 * @description 采用「尽力而为」策略：即使当前没有有效登录态（token 已过期等），也会清理 cookie，
 * 保证客户端不会残留失效令牌；存在有效载荷时才递增 tokenVersion，使已签发的旧令牌立即全部失效
 * @returns 恒为成功，data 为 null
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
 * 修改密码
 * @description 需要登录态；按用户维度限流（10 次/5 分钟）；改密成功后递增 tokenVersion 并清除 cookie，
 * 强制所有已登录设备重新登录（含当前设备）
 * @param input 改密入参（当前密码、新密码）
 * @returns 恒为成功，data 为 null
 * @throws UnauthorizedError 未登录或当前密码错误时
 * @throws RateLimitError 超过限流阈值时
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
 * 更新个人资料
 * @description 需要登录态，仅允许修改本人资料（用户 id 取自令牌而非入参，避免越权改他人）
 * @param input 资料更新入参，字段均可选
 * @returns 成功时 data 为更新后的脱敏用户信息
 * @throws UnauthorizedError 未登录时
 * @throws ValidationError 字段不合法时
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
 * 获取当前登录用户
 * @description 需要登录态；用户 id 取自服务端解析出的令牌载荷，客户端无法指定查询对象
 * @returns 成功时 data 为当前用户的脱敏信息
 * @throws UnauthorizedError 未登录或令牌失效时
 * @throws NotFoundError 用户已被删除时
 */
export async function getMeAction(): Promise<ActionResult<{ user: SafeUser }>> {
  return runAction("Auth", async ({ authPayload }) => {
    const payload = await requireAuthPayload(authPayload);

    const user = await getMe(payload.id);
    return { ok: true, data: { user: toSafeUser(user) } };
  });
}
