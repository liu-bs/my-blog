/**
 * @file authStatus.ts
 * @description 客户端登录态辅助：读取/清除「已登录」标记 Cookie，并通过 localStorage 在同标签页之外广播登出信号
 */
import { AUTH_STATUS_COOKIE } from "@/lib/authConstants";

/** localStorage 中的登出广播 key；其他标签页通过 storage 事件监听它来同步登出 */
const LOGOUT_SIGNAL = "auth_logout_signal";

/**
 * 判断当前浏览器是否带有登录态标记
 * @description 仅用于免请求的快速判断（如是否展示需登录的入口），不具备安全含义——
 * 真正的鉴权以 httpOnly 的 JWT 与服务端校验为准
 * @returns 存在 auth_status=1 时返回 true
 */
export function hasAuthStatus(): boolean {
  return document.cookie.includes(`${AUTH_STATUS_COOKIE}=1`);
}

/**
 * 清除本地登录态并广播登出
 * @description 由于标记 Cookie 非 httpOnly，这里主动置 Max-Age=0 删除；随后写入带时间戳的登出信号，
 * 其他标签页据此同步清空内存中的用户，避免多标签页登录态不一致
 */
export function clearAuthStatus(): void {
  if (hasAuthStatus()) {
    document.cookie = `${AUTH_STATUS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  localStorage.setItem(LOGOUT_SIGNAL, Date.now().toString());
}

/**
 * 判断一次 storage 事件是否为登出广播
 * @param storageEvent 浏览器派发的 storage 事件
 * @returns key 命中登出信号时返回 true
 */
export function wasLogoutSignaled(storageEvent: StorageEvent): boolean {
  return storageEvent.key === LOGOUT_SIGNAL;
}
