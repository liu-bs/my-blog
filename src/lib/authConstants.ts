/**
 * @file authConstants.ts
 * @description 认证相关 Cookie 名常量，服务端写入与中间件/客户端读取共用同一份定义，避免字符串各写一遍导致不一致
 */

/** 存放 JWT 的 httpOnly Cookie 名；proxy.ts 依据它判断受保护路由是否已登录 */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** 非 httpOnly 的「已登录」标记 Cookie，供前端快速判断登录态（值为 "1" 表示已登录） */
export const AUTH_STATUS_COOKIE = "auth_status";
