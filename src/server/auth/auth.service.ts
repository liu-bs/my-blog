/**
 * @file auth.service.ts
 * @description 认证核心业务逻辑：令牌解析与失效校验、注册/登录/登出、改密、资料更新。集中实现 tokenVersion 失效机制与脱敏规则
 * @warning 所有数据访问都走 user.repository，本文件不直接操作 Prisma
 */
import "server-only";

import type { NextRequest } from "next/server";
import { cache } from "react";

/**
 * 用于「邮箱不存在」时的假密码哈希（一个合法的 bcrypt 哈希，无对应明文）
 * @description 登录时无论用户是否存在都执行一次 bcrypt.compare，使两条分支耗时接近，避免通过响应时间枚举已注册邮箱
 */
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
 * 从请求 cookie 中解析当前登录态
 * @description 依次校验：cookie 中存在令牌 → 令牌签名与有效期合法 → 用户仍存在 → tokenVersion 与令牌一致（未登出/改密）→ 账号未被禁用；
 * 任一环节失败都返回 null，避免向调用方泄露失败原因
 * @returns 校验通过返回令牌载荷与数据库用户；否则返回 null
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

/** 对 resolveAuthData 做 React 请求级缓存，同一次渲染/请求内多个组件调用只查一次库 */
const resolveAuthDataCached = cache(resolveAuthData);

/**
 * 获取当前登录用户的令牌载荷
 * @returns 已登录返回 AuthPayload，未登录返回 null
 */
export const getAuthPayload = cache(async (): Promise<AuthPayload | null> => {
  const data = await resolveAuthDataCached();
  return data?.payload ?? null;
});

/**
 * 获取当前登录用户（脱敏）
 * @description 面向页面/组件读取登录态，任何异常都吞掉返回 null，避免鉴权解析失败导致整页崩溃
 * @returns 已登录返回 SafeUser，未登录或解析失败返回 null
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
 * 要求登录，未登录则跳转登录页
 * @description 用于受保护的页面（如后台/写文章），未登录时带上原路径与 stale=1 参数跳转，便于登录后回跳并提示登录态已失效
 * @param locale 当前语言前缀，用于拼出带语言的登录路由
 * @param redirectTo 登录成功后要回跳的路径
 * @returns 登录用户（脱敏）
 * @throws 未登录时不返回而是触发 redirect（以 Next.js 的特殊异常中断执行）
 */
export async function requireUserOrRedirect(locale: string, redirectTo: string): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=${encodeURIComponent(redirectTo)}&stale=1`);
  }
  return user;
}

/**
 * requireAuth 的依赖集合，便于测试时注入替身
 */
export interface AuthDeps {
  /** 令牌签发/校验服务 */
  tokenService: TokenService;
  /** 按 id 查用户，查不到返回 undefined */
  findUserById: (id: string) => Promise<User | undefined>;
}

/**
 * 要求请求已认证（面向 API Route），失败直接抛错
 * @description 与 resolveAuthData 校验链一致，但把失败原因映射为具体错误：令牌过期/非法 → 401，用户不存在 → 401，
 * tokenVersion 不一致（已登出或改密）→ 401，账号被禁用 → 403
 * @param request 携带 cookie 的请求对象
 * @param deps 令牌服务与用户查询依赖
 * @returns 校验通过的令牌载荷
 * @throws UnauthorizedError 未携带令牌、令牌非法/过期、用户不存在或令牌已失效时
 * @throws ForbiddenError 账号被禁用时
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
 * 尝试认证，失败不抛错
 * @description 适用于「登录可选」的接口（如决定返回点赞状态时），未登录按匿名处理
 * @param request 携带 cookie 的请求对象
 * @param deps 令牌服务与用户查询依赖
 * @returns 认证通过返回载荷，否则返回 null
 */
export async function tryAuth(request: NextRequest, deps: AuthDeps): Promise<AuthPayload | null> {
  try {
    return await requireAuth(request, deps);
  } catch {
    return null;
  }
}

/**
 * 把用户对象脱敏为可下发给客户端的 SafeUser
 * @description 剔除 password（绝不外泄）、tokenVersion、disabled，并去掉 likedArticles / favoritedArticles 等仅服务端内部使用的关联字段
 * @param user 数据库完整用户对象
 * @returns 可安全返回给前端的用户对象
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
 * @description 先做邮箱/用户名查重，再补全所有默认字段（角色 Writer、统计归零、外观 system 等）并哈希密码；
 * 即便查重通过，仍以数据库唯一约束兜底捕获并发注册的竞态
 * @param dto 注册入参，邮箱需为小写形式
 * @returns 新建的完整用户对象
 * @throws ConflictError 邮箱或用户名已被占用时
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
 * 登录校验
 * @description 邮箱不存在时用 DUMMY_PASSWORD_HASH 代替真实哈希参与比对，抹平「用户不存在」与「密码错误」的耗时差异；
 * 两种失败统一抛同一句提示，避免账号枚举；账号被禁用单独提示 403
 * @param dto 登录入参（邮箱需小写，与库中存储一致）
 * @returns 校验通过的用户对象
 * @throws UnauthorizedError 邮箱不存在或密码错误时
 * @throws ForbiddenError 账号被禁用时
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
 * 获取指定用户（不脱敏，脱敏由调用方 toSafeUser 完成）
 * @param userId 用户 id
 * @returns 用户完整对象
 * @throws NotFoundError 用户不存在时
 */
export async function getMe(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

/**
 * 登出
 * @description 递增 tokenVersion 使该用户所有已签发令牌立即失效，实现全端登出
 * @param userId 用户 id
 */
export async function logout(userId: string): Promise<void> {
  await bumpTokenVersion(userId);
}

/**
 * 修改密码
 * @description 先用当前密码校验身份（防会话被劫持后直接改密），再写新哈希并递增 tokenVersion，使旧会话全部失效
 * @param userId 用户 id
 * @param dto 改密入参（当前密码、新密码）
 * @throws UnauthorizedError 用户不存在或当前密码错误时
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
 * 更新个人资料
 * @description 采用「字段级合并」语义：未提交的字段保留原值；已提交但为空串的 location/website 允许置空；
 * 改名或换头像后异步同步评论与文章的冗余作者字段，同步失败只记日志、不影响资料更新主流程
 * @param userId 用户 id
 * @param dto 资料更新入参，字段均可选
 * @returns 更新后的用户完整对象
 * @throws NotFoundError 用户不存在时
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

  /** 包装同步任务：结果不阻塞主流程，但会把成功条数或失败原因写入日志便于排查数据不一致 */
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
 * 用「解出的令牌载荷」换回最新用户，用于无数据库会话的续期/鉴权
 * @description 与 resolveAuthData 同样校验用户存在性、tokenVersion 与禁用状态；区别在于入参是已解出的载荷，
 * 适用于中间件等无法直接读 cookie jar 的场景
 * @param decoded 已校验通过的令牌载荷
 * @returns 最新用户对象
 * @throws UnauthorizedError 用户不存在或 tokenVersion 不一致（令牌已被登出/改密作废）时
 * @throws ForbiddenError 账号被禁用时
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
