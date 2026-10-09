/**
 * @file AuthProvider.tsx
 * @description 客户端登录态上下文：启动时读取 localStorage 缓存秒回显用户，再经 getMeAction 校验刷新；
 * 监听 storage 事件实现多标签页同步登出，向全站组件暴露 user/loading 及刷新、局部更新方法
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@shared";
import { getMeAction } from "@server/auth/auth.controller";
import { clearAuthStatus, hasAuthStatus, wasLogoutSignaled } from "@/lib/authStatus";

/** localStorage 中缓存用户信息的 key */
const USER_CACHE_KEY = "auth_user_cache";

/** 缓存恢复阶段的占位角色，真实 role 以 getMeAction 返回为准 */
const PLACEHOLDER_ROLE = "Writer";

/** 缓存的用户数据结构：剔除 role 字段（避免权限信息长期驻留本地） */
type CachedUser = Omit<User, "role">;

/**
 * 从 localStorage 读取缓存的用户信息
 * @returns 带占位 role 的 User，无缓存或 JSON 解析失败时返回 null
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
 * 将用户信息写入（或清除）localStorage 缓存
 * @param user 当前用户，null 时移除缓存项
 * @warning 写入前会剥离 role 字段，缓存恢复后 role 为占位值
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

/** AuthContext 暴露给消费组件的状态与方法 */
interface AuthContextValue {
  /** 当前登录用户，未登录为 null */
  user: User | null;

  /** 是否正在向服务端校验登录态（首屏缓存回显期间也可能为 true） */
  loading: boolean;

  /** 调用 getMeAction 重新拉取当前用户并更新缓存 */
  refreshMe: () => Promise<void>;

  /** 直接用给定用户（或 null）覆盖当前登录态，登录/登出成功后调用 */
  setMe: (user: User | null) => void;

  /** 局部更新当前用户字段（如修改资料后），user 为 null 时不生效 */
  patchMe: (partial: Partial<User>) => void;
}

/** 登录态上下文，默认 null 以便 useAuth 检测未包裹场景 */
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 登录态 Provider，包裹在 Providers 内、全站组件外层
 * @param props.children 子树组件
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  /* 当前登录用户 */
  const [user, setUser] = useState<User | null>(null);

  /* 登录态校验中标志，首屏默认 true 避免未登录 UI 闪烁 */
  const [loading, setLoading] = useState(true);

  /**
   * 统一的用户状态写入口：同时更新 state 与 localStorage 缓存
   * @param next 新的用户对象或 null
   */
  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    writeCachedUser(next);
  }, []);

  /**
   * 调用 getMeAction 校验登录态：成功写入用户；401 视为登出并清除登录标记；
   * 其余错误仅打印日志，保留现有状态
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
   * 初始化登录态：本地无登录标记直接置未登录；有标记先用缓存回显再请求服务端刷新。
   * 同时监听 storage 事件，其他标签页登出时同步清空本地登录态
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

    /**
     * 跨标签页登出同步：其他页写登出标记到 localStorage 时触发
     * @param e 原生 storage 事件
     */
    const syncLogout = (e: StorageEvent) => {
      if (wasLogoutSignaled(e)) applyUser(null);
    };
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, [refreshMe, applyUser]);

  /* setMe 复用 applyUser，外部传入用户对象即同步缓存 */
  const setMe = applyUser;

  /**
   * 局部合并更新当前用户字段并刷新缓存
   * @param partial 需要覆盖的用户字段子集
   */
  const patchMe = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      writeCachedUser(next);
      return next;
    });
  }, []);

  /* 上下文值引用稳定化，避免每次渲染触发消费组件重渲染 */
  const value = useMemo(
    () => ({ user, loading, refreshMe, setMe, patchMe }),
    [user, loading, refreshMe, setMe, patchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 读取登录态上下文的 Hook
 * @returns {@link AuthContextValue} 登录状态与操作方法
 * @throws 在 AuthProvider 之外调用时抛错
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
