/**
 * @file AuthProvider.tsx
 * @description 全站登录态上下文：维护当前用户、注册 / 登录 / 登出的客户端视图，并向子树暴露刷新、覆写与局部更新的方法。
 *              采用「本地缓存乐观渲染 + 服务端 /me 校正」的策略，使已登录用户刷新页面时不必先看到未登录界面
 * @warning 这里的 user 只是客户端视图，不能作为权限依据；真正的鉴权由服务端中间件与 Server Action 内的会话校验负责
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@shared";
import { getMeAction } from "@server/auth/auth.controller";
import { clearAuthStatus, hasAuthStatus, wasLogoutSignaled } from "@/lib/authStatus";

/** 用户信息在 localStorage 中的缓存键 */
const USER_CACHE_KEY = "auth_user_cache";

/**
 * 从缓存恢复用户时填入的占位角色
 * @description 角色不写入缓存（见 writeCachedUser），因此命中缓存的首帧只能给出一个中性占位值，
 *              待 /me 返回后用真实 role 覆盖，避免把可能过期的权限信息当成事实
 */
const PLACEHOLDER_ROLE = "Writer";

/** 可缓存的用户信息：剔除 role，避免过期权限被持久化后误导 UI */
type CachedUser = Omit<User, "role">;

/**
 * 读取本地缓存的用户信息
 * @description 解析失败（缓存被污染 / 结构变更）时静默返回 null，由后续 /me 请求兜底，不让脏缓存阻断启动
 * @returns 缓存中的用户信息，缺失或异常时返回 null
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
 * 写入 / 清除本地用户缓存
 * @description 写入前剔除 role 字段（仅保留可公开展示的资料），登出时传入 null 即删除缓存；
 *              localStorage 可能因隐私模式或配额抛错，因此整体包 try-catch 并忽略失败 —— 缓存只是加速手段，不应影响功能
 * @param user 待缓存的用户信息，传 null 表示清除缓存
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
 * 登录态上下文的取值
 */
interface AuthContextValue {
  /** 当前用户，null 表示未登录或尚未确认 */
  user: User | null;

  /** 用户态是否仍在首次确认中；为 true 时守卫组件应渲染骨架屏而非登录提示 */
  loading: boolean;

  /** 主动向服务端重新拉取当前用户，并同步缓存 */
  refreshMe: () => Promise<void>;

  /** 直接覆写用户态（登录后置入、登出或会话失效时置空），同时写缓存 */
  setMe: (user: User | null) => void;

  /** 局部更新当前用户字段（如改资料后的即时回显），仅在有用户时生效 */
  patchMe: (partial: Partial<User>) => void;
}

/** 登录态上下文；未提供 Provider 时为 null，由 useAuth 负责报错提示 */
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider 登录态提供者
 * @description 初始化策略（在 effect 中执行一次）：
 *              1）没有鉴权标记 cookie —— 直接判定未登录，省掉一次 /me 请求；
 *              2）有标记 —— 先用本地缓存乐观渲染以消除闪烁，再异步 refreshMe 取权威数据校正。
 *              同时监听 storage 事件，让同一浏览器其它标签页登出时，本页也能同步清空用户态
 * @param props 组件入参
 * @param props.children 应用子树
 * @returns 提供登录态上下文的 Provider
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  /** 当前用户；初始为 null，由 effect 决定是否用缓存填充 */
  const [user, setUser] = useState<User | null>(null);

  /** 是否仍在确认登录态；初始为 true，任何一条初始化分支都必须把它置回 false */
  const [loading, setLoading] = useState(true);

  /**
   * 统一写入口：更新内存态并同步持久化缓存
   * @description 保证 user 与缓存永远一致，避免出现「界面已登出、缓存仍留着资料」的中间态
   * @param next 新的用户态
   */
  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    writeCachedUser(next);
  }, []);

  /**
   * 从服务端拉取当前用户并校正本地状态
   * @description 401 视为会话失效：清空用户态与鉴权标记；
   *              其它异常（网络抖动等）只记日志、保留缓存渲染结果，避免把偶发失败误判为登出；
   *              无论成功失败都会结束 loading，防止骨架屏永久停留
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
   * 初始化登录态并监听跨标签页登出
   * @description 首次确认只做一次：无鉴权标记直接判定未登录；有标记则先吃缓存再请求校正。
   *              storage 事件监听在卸载时清除，避免热更新 / 重复挂载累积监听器
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

    // 其它标签页触发登出时会写入该信号键，本页据此同步清空用户态
    const syncLogout = (e: StorageEvent) => {
      if (wasLogoutSignaled(e)) applyUser(null);
    };
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, [refreshMe, applyUser]);

  /** 对外的用户态覆写方法，直接复用 applyUser 以同时维护缓存 */
  const setMe = applyUser;

  /**
   * 局部更新用户资料
   * @description 用函数式更新保证基于最新值合并；无用户时原样返回，避免登出后残留的异步回调凭空造出一个用户
   * @param partial 待覆盖的字段子集
   */
  const patchMe = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      writeCachedUser(next);
      return next;
    });
  }, []);

  /** 上下文值做 memo，避免每次渲染都让所有消费者重新渲染 */
  const value = useMemo(
    () => ({ user, loading, refreshMe, setMe, patchMe }),
    [user, loading, refreshMe, setMe, patchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 读取登录态上下文
 * @description 刻意在缺失 Provider 时抛错而非返回默认值：静默降级会让「忘记包 Provider」变成一个难以定位的登录态 bug
 * @returns 登录态上下文取值
 * @throws 在 AuthProvider 之外调用时抛出 Error
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
