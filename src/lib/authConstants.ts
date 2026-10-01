/**
 * @file authConstants.ts
 * @description 认证相关 cookie 键名常量：登录 token 与登录状态标记
 */

/** 登录 token cookie 名，服务端写入、proxy 读取 */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** 登录状态标记 cookie 名（非 httpOnly，客户端可读写） */
export const AUTH_STATUS_COOKIE = "auth_status";
