/**
 * @file index.ts
 * @description validation 层聚合入口（经 @shared 导出）：仅 re-export postId 与 primitives（二者仅依赖 zod 类型）
 * 及各表单的字段名类型；auth/blog/comment 的 schema 值不进聚合导出，
 * 消费方（server 各领域 validator 与表单组件）从具体文件路径按需导入。
 */
export * from "./primitives";
export * from "./postId";

export type { ChangePasswordField, ProfileField } from "./auth";
export type { CommentField } from "./comment";
export type { PostFormField } from "./blog";
