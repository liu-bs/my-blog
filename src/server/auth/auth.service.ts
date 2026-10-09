import "server-only";

/**
 * @file 认证与用户业务服务层
 * @description 承载注册/登录/登出/改密/资料更新的业务逻辑，以及 JWT 会话解析的三种形态：
 * RSC/Server Action 用 getAuthPayload（React cache 去重）、Route Handler 用 requireAuth/tryAuth（依赖注入）、
 * 页面级守卫用 requireUserOrRedirect。密码哈希与 token 签发分别委托 password.service / token.service，
 * 数据读写全部走 user.repository。
 */

import type { NextRequest } from "next/server";
import { cache } from "react";
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
import { AUTH_TOKEN_COOKIE } from "@shared";
import { joinName } from "@shared/format";
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

// 用于恒定时间比较的假哈希：登录失败时也跑一遍 bcrypt 校验，避免时序攻击暴露"用户是否存在"。
const DUMMY_PASSWORD_HASH = "$2b$10$EEuWh8NBvDVQU0H3Nueyju/L/PkhwhtYGHTgoh92VnpGbaozrN6u.";

export type { UpdateProfileDto, SafeUser };

/**
 * 解析当前请求的认证信息（无缓存版本）
 * @description 从 Cookie 取 JWT → 验签 → 查用户 → 校验 tokenVersion 与禁用状态，任一环节不通过均返回 null（不抛错）
 * @returns 认证通过时返回 token payload 与完整用户记录，否则 null
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

/** React cache 包装：同一次请求内多处调用共享一次 Cookie 解析与用户查询 */
const resolveAuthDataCached = cache(resolveAuthData);

/**
 * 获取当前请求的 JWT payload（Server Action / RSC 专用）
 * @description 内部经 resolveAuthDataCached 去重；不抛错，由调用方判空
 * @returns 已认证的 payload，未登录或 token 失效时为 null
 */
export const getAuthPayload = cache(async (): Promise<AuthPayload | null> => {
  const data = await resolveAuthDataCached();
  return data?.payload ?? null;
});

/**
 * 获取当前登录用户的脱敏信息（请求级缓存，异常时静默返回 null）
 */
const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  try {
    const data = await resolveAuthDataCached();
    if (!data) return null;
    return toSafeUser(data.user);
  } catch {
    return null;
  }
});

/**
 * RSC 页面级登录守卫：未登录则重定向到登录页并携带回跳地址
 * @param redirectTo 登录成功后要回跳的目标路径（会被 URL 编码放进 ?redirect 参数）
 * @returns 已登录用户的脱敏信息
 */
export async function requireUserOrRedirect(redirectTo: string): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}&stale=1`);
  }
  return user;
}

/**
 * Route Handler 鉴权所需的依赖注入集合（便于单测替换真实的 token 服务与用户查询）
 */
export interface AuthDeps {
  /** JWT 签发/验签服务 */
  tokenService: TokenService;

  /** 按用户 ID 查询完整用户记录 */
  findUserById: (id: string) => Promise<User | undefined>;
}

/**
 * REST 路由强制鉴权：解析请求 Cookie 中的 JWT 并逐层校验
 * @param request 当前 Next 请求（从 request.cookies 读取）
 * @param deps 鉴权依赖（token 服务 + 用户查询）
 * @returns 校验通过的 token payload
 * @throws UnauthorizedError——无 token（401）、token 过期或无效（401）、用户不存在（401）、tokenVersion 不匹配（401）；ForbiddenError——账号被禁用（403）
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
 * REST 路由可选鉴权：任何鉴权失败都不抛错
 * @param request 当前 Next 请求
 * @param deps 鉴权依赖
 * @returns 已认证的 payload，未登录/失效时为 null
 */
export async function tryAuth(request: NextRequest, deps: AuthDeps): Promise<AuthPayload | null> {
  try {
    return await requireAuth(request, deps);
  } catch {
    return null;
  }
}

/**
 * 剔除用户敏感字段（密码哈希、tokenVersion、禁用标记），得到可下发前端的 SafeUser
 * @param user 完整用户记录
 * @returns 脱敏后的用户信息
 */
export function toSafeUser(user: User): SafeUser {
  const { password: _p, tokenVersion: _t, disabled: _d, ...safe } = user;
  void _p;
  void _t;
  void _d;
  return safe;
}

/**
 * 注册新用户
 * @description 先查重再落库；密码经 bcrypt 哈希存储；并发场景下依赖数据库唯一约束兜底（P2002 转 409）
 * @param dto 注册参数（邮箱、用户名、密码、姓名）
 * @returns 新创建的用户完整记录
 * @throws ConflictError——邮箱或用户名已被占用（409）
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
 * 登录校验（只验证凭证，不签发 Cookie，Cookie 由 controller 层写入）
 * @param dto 登录参数（邮箱 + 密码）
 * @returns 校验通过的用户完整记录
 * @throws UnauthorizedError——邮箱或密码错误（401，统一文案不暴露用户是否存在）；ForbiddenError——账号被禁用（403）
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
 * 查询"我"的完整用户记录
 * @param userId 已认证用户的 ID（来自 token payload）
 * @returns 用户完整记录
 * @throws NotFoundError——用户不存在（404）
 */
export async function getMe(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

/**
 * 服务端登出：递增 tokenVersion，使该用户此前签发的所有 JWT 立即失效
 * @param userId 用户 ID
 */
export async function logout(userId: string): Promise<void> {
  await bumpTokenVersion(userId);
}

/**
 * 修改密码
 * @description 校验当前密码 → 写入新哈希 → 递增 tokenVersion 强制所有端重新登录
 * @param userId 已认证用户的 ID
 * @param dto 修改密码参数（当前密码 + 新密码）
 * @throws UnauthorizedError——用户不存在或当前密码错误（401）
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
 * 更新个人资料（局部更新：仅覆盖 dto 中显式传入的字段）
 * @description 姓名/头像变更后级联同步该用户的评论展示信息与文章 authorName；
 * 级联是尽力而为——用 safeSync 包裹，失败只记日志不回滚资料更新，避免附属表同步失败阻断主流程。
 * @param userId 已认证用户的 ID
 * @param dto 资料更新参数
 * @returns 更新后的用户完整记录
 * @throws NotFoundError——用户不存在（404）
 * @warning 评论/文章同步在资料更新事务之外执行，存在短暂不一致窗口
 */
export async function updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const firstName = dto.firstName !== undefined ? dto.firstName.trim() : user.firstName;
  const lastName = dto.lastName !== undefined ? dto.lastName.trim() : user.lastName;
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

  const newName = joinName(firstName, lastName) || user.username;
  const newAvatar = avatar || undefined;

  // 附属同步的容错包装：成功且有变更条数记 info，失败仅记 error，不影响资料更新结果
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
 * 依据已解码的 token payload 刷新并复核用户状态（供续期/滚动校验场景使用）
 * @param decoded token 中的 payload
 * @returns 仍然有效的用户完整记录
 * @throws UnauthorizedError——用户不存在或 tokenVersion 已变化（401）；ForbiddenError——账号被禁用（403）
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
