/**
 * @file index.ts
 * @description 服务端（backend）专属共享类型的统一出口。这里放的是「只在 Node 侧使用、
 *              但需要与前端共享类型定义」的契约，目前仅有认证令牌 / 密码服务接口。
 */
export * from "./auth";
