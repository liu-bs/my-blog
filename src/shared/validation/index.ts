/**
 * @file index.ts
 * @description 校验层统一出口。聚合两类内容：
 *              1）校验工具函数（primitives 的 URL 安全判断与 zod issue 格式化、postId 的编码/解码/路径构造）；
 *              2）各领域 schema 派生出的「字段名联合类型」，仅作类型使用故以 `export type` 导出。
 * @warning 具体 schema 不在此处聚合，使用方按文件路径（如 `@/shared/validation/blog`）直接引入；
 *          这里增删导出会同时影响前后端两侧的引用
 */
export * from "./primitives";
export * from "./postId";

export type { ChangePasswordField, ProfileField } from "./auth";
export type { CommentField } from "./comment";
export type { PostFormField } from "./blog";
