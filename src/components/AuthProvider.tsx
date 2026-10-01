/**
 * @file AuthProvider.tsx
 * @description 全局登录态 Provider：localStorage 缓存用户实现秒开（缓存剥离 role 字段，
 *              读取时以 PLACEHOLDER_ROLE 占位防伪造权限）；就绪后经 getMeAction 拉取真实用户
 *              （不加载点赞/收藏关联，减轻请求）；401 视为未登录并清理登录标记；
 *              监听 storage 事件实现跨标签页登出同步
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@shared";
import { getMeAction } from "@server/auth/auth.controller";
import { clearAuthStatus, hasAuthStatus, wasLogoutSignaled } from "@/lib/authStatus";

/** 用户缓存 localStorage 键 */
const USER_CACHE_KEY = "auth_user_cache";

/** 缓存不落盘 role 字段，读取时以此占位（真实角色以服务端返回为准，防本地篡改提权） */
const PLACEHOLDER_ROLE = "Writer";

/** 可缓存用户类型（剥离 role） */
type CachedUser = Omit<User, "role">;

/**
 * 读取本地缓存的用户：补上 role 占位字段；解析失败视为无缓存
 * @returns 缓存用户或 null
 */
function readCachedUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedUser;
    return { ...parsed, role: PLACEHOLDER_ROLE };
  } catch {
    return null;
  }
}

/**
 * 写入/清除用户缓存：缓存前剥离 role 字段
 * @param user 最新用户，null 表示清除缓存
 */
function writeCachedUser(user: User | null): void {
  try {
    if (user) {
      const { role: _role, ...cacheable } = user;
      void _role;
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheable));
    } else {
      window.localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {}
}

/**
 * 登录态上下文值
 */
interface AuthContextValue {
  /** 当前登录用户，null 表示未登录 */
  user: User | null;

  /** 登录态是否加载中 */
  loading: boolean;

  /** 从服务端拉取最新用户并同步缓存 */
  refreshMe: () => Promise<void>;

  /** 覆盖设置用户（null 即登出，同步缓存） */
  setMe: (user: User | null) => void;

  /** 局部合并更新用户（如资料修改后的即时同步） */
  patchMe: (partial: Partial<User>) => void;
}

/** 登录态 Context，未包裹 Provider 时为 null */
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider 全局登录态容器
 * @param children 应用子节点
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  /** 当前登录用户 */
  const [user, setUser] = useState<User | null>(null);

  /** 首次登录态加载标记 */
  const [loading, setLoading] = useState(true);

  /** 统一的用户更新入口：setState 同时同步 localStorage 缓存 */
  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    writeCachedUser(next);
  }, []);

  /**
   * 拉取服务端最新用户（不加载点赞/收藏关联）：
   * 成功更新用户与缓存；401 视为已登出，清用户并清理登录标记；其余错误仅开发态打印
   */
  const refreshMe = useCallback(async () => {
    try {
      const result = await getMeAction();
      if (result.ok) {
        applyUser(result.data.user);
      } else if (result.status === 401) {
        applyUser(null);
        clearAuthStatus();
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[AuthProvider] refreshMe failed", err);
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  /**
   * 挂载时初始化登录态：无登录标记直接置未登录；
   * 有标记先读缓存秒开（role 为占位），再 refreshMe 换取真实数据；
   * 并监听 storage 事件——其他标签页登出时（写入登出信号）同步本页登出
   */
  useEffect(() => {
    if (!hasAuthStatus()) {
      applyUser(null);
      setLoading(false);
    } else {
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
        setLoading(false);
      }
      refreshMe();
    }

    /** 跨标签页登出同步：检测到登出信号时清空本页用户 */
    const syncLogout = (e: StorageEvent) => {
      if (wasLogoutSignaled(e)) applyUser(null);
    };
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, [refreshMe, applyUser]);

  /** 覆盖设置用户（即 applyUser） */
  const setMe = applyUser;

  /** 局部合并更新用户并同步缓存（用户未登录时忽略） */
  const patchMe = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      writeCachedUser(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshMe, setMe, patchMe }),
    [user, loading, refreshMe, setMe, patchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 读取登录态上下文，必须在 AuthProvider 内使用
 * @returns 用户、加载态与更新方法
 * @throws 在 Provider 外调用时抛出错误
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
