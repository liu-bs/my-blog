/**
 * @file auth.service.ts
 * @description 认证业务服务。RSC 场景基于 cookies() 做请求级缓存的登录态解析（getAuthPayload/
 * getCurrentUser），Route Handler 场景提供 requireAuth/tryAuth；实现注册、登录、登出、
 * 改密、资料更新与令牌刷新。登录对不存在用户比较 DUMMY_PASSWORD_HASH 防时序侧信道；
 * 登出/改密通过 bumpTokenVersion 吊销全部旧 token。
 */
import "server-only";

import type { NextRequest } from "next/server";
import { cache } from "react";

// 预生成的 bcrypt 假哈希：登录时对不存在的用户也执行一次比较，抹平响应时间差防用户枚举
const DUMMY_PASSWORD_HASH = "$2b$10$EEuWh8NBvDVQU0H3Nueyju/L/PkhwhtYGHTgoh92VnpGbaozrN6u.";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type {
  User,
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  UpdateProfileDto,
  SafeUser,
  AuthPayload,
} from "@shared";
import { randomUUID } from "node:crypto";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@server/common/errors";
import { passwordService } from "./password.service";
import { logger } from "@server/common/logger";
import { tokenService, type TokenService } from "./token.service";
import { AUTH_TOKEN_COOKIE } from "@/lib/authConstants";
import {
  findUserById,
  findUserByEmail,
  existsByEmailOrUsername,
  createUser,
  updateUser,
  bumpTokenVersion,
  isUniqueConstraintError,
} from "@server/user/user.repository";

import { syncCommentAuthorProfile } from "@server/comment/comment.service";
import { syncPostAuthorName } from "@server/blog/blog.service";

export type { UpdateProfileDto, SafeUser };

/**
 * 从请求 Cookie 解析完整登录态：校验 JWT 签名与有效期，
 * 并二次校验库中 tokenVersion 一致（登出/改密后旧 token 立即失效）且账号未被禁用
 * @returns 载荷与用户实体，任一校验失败返回 null
 */
async function resolveAuthData(): Promise<{ payload: AuthPayload; user: User } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const result = tokenService.verify(token);
  if (!result.success) return null;

  const decoded = result.payload;

  const user = await findUserById(decoded.id).catch(() => undefined);
  if (!user) return null;
  if ((user.tokenVersion ?? 0) !== decoded.tokenVersion) return null;
  if (user.disabled) return null;

  return { payload: decoded, user };
}

// React cache 请求级去重：同一次渲染/请求内多次解析登录态只查一次库
const resolveAuthDataCached = cache(resolveAuthData);

/**
 * 获取当前请求的认证载荷（请求级缓存）
 * @returns 载荷（仅 id + tokenVersion），未登录返回 null
 */
export const getAuthPayload = cache(async (): Promise<AuthPayload | null> => {
  const data = await resolveAuthDataCached();
  return data?.payload ?? null;
});

/**
 * 获取当前登录用户的脱敏信息（请求级缓存，异常时静默返回 null）
 * @returns SafeUser，未登录返回 null
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  try {
    const data = await resolveAuthDataCached();
    if (!data) return null;
    return toSafeUser(data.user);
  } catch {
    return null;
  }
});

/**
 * 要求已登录，否则重定向到登录页（RSC 保护页面用）
 * @param locale 当前语言前缀
 * @param redirectTo 登录成功后的回跳地址
 * @returns 当前登录用户（脱敏后）
 */
export async function requireUserOrRedirect(locale: string, redirectTo: string): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=${encodeURIComponent(redirectTo)}&stale=1`);
  }
  return user;
}

/**
 * 认证依赖注入接口，解耦 Route Handler 与具体实现便于测试
 */
export interface AuthDeps {
  /** JWT 校验服务 */
  tokenService: TokenService;

  /** 按用户 id 查询用户的仓储函数 */
  findUserById: (id: string) => Promise<User | undefined>;
}

/**
 * Route Handler 强制认证：校验 cookie 中的 JWT、库中 tokenVersion 一致性与账号状态
 * 校验失败按原因抛出带具体提示的 UnauthorizedError/ForbiddenError
 * @param request 请求对象
 * @param deps 认证依赖
 * @returns 认证载荷
 * @throws 未登录/token 过期或无效/用户不存在/tokenVersion 不匹配时抛 UnauthorizedError；账号禁用抛 ForbiddenError
 */
export async function requireAuth(request: NextRequest, deps: AuthDeps): Promise<AuthPayload> {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) {
    throw new UnauthorizedError("Unauthorized, please log in first");
  }

  const result = deps.tokenService.verify(token);
  if (!result.success) {
    const msg =
      result.errorType === "expired"
        ? "Login session has expired, please log in again"
        : "Token is invalid, please log in again";
    throw new UnauthorizedError(msg);
  }

  const decoded = result.payload;
  const user = await deps.findUserById(decoded.id).catch(() => undefined);
  if (!user) {
    throw new UnauthorizedError("User not found, please log in again");
  }
  if ((user.tokenVersion ?? 0) !== decoded.tokenVersion) {
    throw new UnauthorizedError("Token has expired, please log in again");
  }
  if (user.disabled) {
    throw new ForbiddenError("Account has been disabled");
  }
  return decoded;
}

/**
 * Route Handler 可选认证：尝试解析登录态，任何失败均返回 null 而不抛错
 * @param request 请求对象
 * @param deps 认证依赖
 * @returns 认证载荷，未登录或校验失败时为 null
 */
export async function tryAuth(request: NextRequest, deps: AuthDeps): Promise<AuthPayload | null> {
  try {
    return await requireAuth(request, deps);
  } catch {
    return null;
  }
}

/**
 * 剥离敏感字段（password/tokenVersion/disabled）得到对外安全的用户视图
 * @param user 完整用户模型
 * @returns 可安全下发给前端的 SafeUser
 */
export function toSafeUser(user: User): SafeUser {
  const { password: _p, tokenVersion: _t, disabled: _d, ...safe } = user;
  void _p;
  void _t;
  void _d;
  return safe;
}

/**
 * 用户注册：先查重（邮箱/用户名），哈希密码后落库；并发下唯一约束冲突也转为业务冲突错误
 * @param dto 已校验的注册数据（email 为小写）
 * @returns 创建成功的完整 User
 * @throws 邮箱或用户名已存在时抛 ConflictError
 */
export async function register(dto: RegisterDto): Promise<User> {
  const exists = await existsByEmailOrUsername(dto.email, dto.username);
  if (exists) {
    throw new ConflictError("Email or username already in use");
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: randomUUID(),
    ...dto,
    password: await passwordService.hash(dto.password),
    avatar: "",
    coverImage: "",
    bio: "",
    location: "",
    website: "",
    joined: new Date().toISOString(),
    role: "Writer",
    company: "",
    verified: false,
    disabled: false,
    tags: [],
    social: { twitter: "", github: "", linkedin: "" },
    stats: { articles: 0, likes: 0, views: 0 },
    tokenVersion: 0,
    appearance: { theme: "system", fontSize: "medium" },
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await createUser(newUser);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError("Email or username already in use");
    }
    throw err;
  }
}

/**
 * 用户登录校验：无论用户是否存在都执行一次 bcrypt 比较（DUMMY_PASSWORD_HASH 防时序侧信道），
 * 再校验账号未禁用；Cookie 签发由控制器层负责
 * @param dto 已校验的登录数据（email 为小写）
 * @returns 登录成功的用户实体
 * @throws 凭据错误抛 UnauthorizedError；账号禁用抛 ForbiddenError
 */
export async function login(dto: LoginDto): Promise<User> {
  const user = await findUserByEmail(dto.email);
  const matched = await passwordService.compare(
    dto.password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !matched) {
    throw new UnauthorizedError("Email or password incorrect");
  }
  if (user.disabled) {
    throw new ForbiddenError("Account has been disabled");
  }
  return user;
}

/**
 * 查询当前登录用户完整信息
 * @param userId 用户 id
 * @returns 完整 User
 * @throws 用户不存在时抛 NotFoundError
 */
export async function getMe(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

/**
 * 登出：自增 tokenVersion 吊销该用户所有已签发 JWT（服务端真吊销，Cookie 清理由控制器负责）
 * @param userId 用户 id
 */
export async function logout(userId: string): Promise<void> {
  await bumpTokenVersion(userId);
}

/**
 * 修改密码：校验旧密码后写入新哈希，并自增 tokenVersion 强制全部旧 token 失效（需重新登录）
 * @param userId 用户 id
 * @param dto 已校验的改密数据（当前密码 + 新密码）
 * @throws 当前密码错误抛 UnauthorizedError
 */
export async function changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await findUserById(userId);
  if (!user || !(await passwordService.compare(dto.currentPassword, user.password ?? ""))) {
    throw new UnauthorizedError("Current password incorrect");
  }
  await updateUser(userId, {
    password: await passwordService.hash(dto.newPassword),
  });
  await bumpTokenVersion(userId);
}

/**
 * 更新用户资料，并将新昵称/头像异步同步到已有评论与文章作者冗余字段
 * 同步失败仅记日志不阻断资料更新本身
 * @param userId 用户 id
 * @param dto 已校验的资料字段
 * @returns 更新后的 User
 * @throws 用户不存在时抛 NotFoundError
 */
export async function updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const firstName = dto.firstName?.trim() || user.firstName;
  const lastName = dto.lastName?.trim() || user.lastName;
  const avatar = dto.avatar ?? user.avatar;
  const bio = dto.bio?.trim() ?? user.bio;
  const location = dto.location !== undefined ? dto.location.trim() || "" : user.location;
  const website = dto.website !== undefined ? dto.website.trim() || "" : user.website;

  const updated = await updateUser(userId, {
    firstName,
    lastName,
    avatar,
    bio,
    location,
    website,
  });
  if (!updated) {
    throw new NotFoundError("User not found");
  }

  const newName = `${firstName} ${lastName}`.trim() || user.username;
  const newAvatar = avatar || undefined;

  /** 记录并吞掉同步失败的内部辅助：成功记 info（含影响行数），失败记 error 且不向上抛 */
  const safeSync = (label: string, fn: () => Promise<unknown>) =>
    fn()
      .then((result) => {
        const count = typeof result === "number" ? result : null;
        if (count === null || count > 0) {
          logger.info(`Synced ${label}`, { userId, ...(count !== null ? { count } : {}) });
        }
      })
      .catch((err: unknown) => {
        logger.error(`Failed to sync ${label}`, {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

  await safeSync("comments with updated username/avatar", () =>
    syncCommentAuthorProfile(userId, newName, newAvatar ?? null),
  );
  await safeSync("post authorName", () => syncPostAuthorName(userId, newName));

  return updated;
}

/**
 * 刷新令牌前的复核：按载荷查用户并校验 tokenVersion 一致、账号未禁用，
 * 通过后由控制器签发新 Cookie
 * @param decoded 旧 token 的载荷
 * @returns 刷新有效的用户实体
 * @throws 用户不存在/tokenVersion 不匹配抛 UnauthorizedError；账号禁用抛 ForbiddenError
 */
export async function refresh(decoded: AuthPayload): Promise<User> {
  const user = await findUserById(decoded.id);
  if (!user) {
    throw new UnauthorizedError("User not found");
  }
  if ((user.tokenVersion ?? 0) !== decoded.tokenVersion) {
    throw new UnauthorizedError("Token has expired, please log in again");
  }
  if (user.disabled) {
    throw new ForbiddenError("Account has been disabled");
  }
  return user;
}
