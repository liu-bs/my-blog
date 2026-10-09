/**
 * @file constants.ts
 * @description 全局共享的 Cookie 名称常量，服务端与客户端统一从此处引用（经 @shared 聚合导出），
 * 避免字符串散落各处导致读写不一致。
 */

/** 登录令牌 Cookie 名（httpOnly），由 server/auth/auth.cookie.ts 写入，src/proxy.ts、auth.service、api/auth/refresh 读取用于登录校验 */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** 登录状态标记 Cookie 名（非 httpOnly，值恒为 "1"），供客户端 lib/authStatus.ts 判断是否展示已登录 UI */
export const AUTH_STATUS_COOKIE = "auth_status";
