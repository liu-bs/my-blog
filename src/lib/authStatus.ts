/**
 * @file authStatus.ts
 * @description 客户端登录状态辅助：检测/清除 auth_status cookie，登出时写 localStorage 信号供其他标签页监听同步登出
 */
import { AUTH_STATUS_COOKIE } from "@/lib/authConstants";

/** 登出广播信号在 localStorage 中的键 */
const LOGOUT_SIGNAL = "auth_logout_signal";

/** 是否存在登录状态标记 cookie */
export function hasAuthStatus(): boolean {
  return document.cookie.includes(`${AUTH_STATUS_COOKIE}=1`);
}

/** 清除登录状态 cookie，并写 localStorage 广播登出信号（跨标签页同步） */
export function clearAuthStatus(): void {
  if (hasAuthStatus()) {
    document.cookie = `${AUTH_STATUS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  localStorage.setItem(LOGOUT_SIGNAL, Date.now().toString());
}

/**
 * 判断 storage 事件是否为登出信号
 * @param storageEvent storage 事件对象
 * @returns 是否为登出广播
 */
export function wasLogoutSignaled(storageEvent: StorageEvent): boolean {
  return storageEvent.key === LOGOUT_SIGNAL;
}
