/**
 * @file authStatus.ts
 * @description 登录状态本地信号工具：读写认证状态 Cookie，登出时清除 Cookie 并通过 localStorage 广播跨标签页登出信号
 */
import { AUTH_STATUS_COOKIE } from "@shared";

/** localStorage 中登出信号的 key，其他标签页通过 storage 事件感知 */
const LOGOUT_SIGNAL = "auth_logout_signal";

/**
 * 判断浏览器是否存在已登录状态标记 Cookie
 * @returns Cookie 中含 auth 状态标记（值为 1）时返回 true
 * @warning 仅为展示层快速判断，真实鉴权以服务端为准；仅限浏览器环境调用
 */
export function hasAuthStatus(): boolean {
  return document.cookie.includes(`${AUTH_STATUS_COOKIE}=1`);
}

/**
 * 清除登录状态：删除认证 Cookie 并写入登出信号触发其他标签页同步登出
 * @warning 写 localStorage 会派发 storage 事件，配合 {@link wasLogoutSignaled} 监听方需自行处理登出
 */
export function clearAuthStatus(): void {
  if (hasAuthStatus()) {
    document.cookie = `${AUTH_STATUS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  localStorage.setItem(LOGOUT_SIGNAL, Date.now().toString());
}

/**
 * 判断 storage 事件是否来自本应用的登出信号
 * @param storageEvent 浏览器 window storage 事件
 * @returns 事件 key 为登出信号 key 时返回 true
 */
export function wasLogoutSignaled(storageEvent: StorageEvent): boolean {
  return storageEvent.key === LOGOUT_SIGNAL;
}
