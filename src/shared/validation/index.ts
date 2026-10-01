/**
 * @file index.ts
 * @description validation 子目录 barrel：仅转发无 zod 运行时依赖的模块（primitives/postId）
 *              与纯类型导出。含 zod schema 的模块（auth/comment/blog）禁止从这里 re-export——
 *              使用方必须按模块路径直接 import，防止 zod 全量核心被打进客户端 chunk
 */
export * from "./primitives";
export * from "./postId";

export type { ChangePasswordField, ProfileField } from "./auth";
export type { CommentField } from "./comment";
export type { PostFormField } from "./blog";
