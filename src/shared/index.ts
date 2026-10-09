/**
 * @file index.ts
 * @description shared 层聚合入口（barrel），经 @shared 别名导出常量、共享类型与校验 schema。
 * 注意：validation 入口仅聚合导出 primitives 与 postId；auth/blog/comment 的 schema
 * 由消费方（server 各领域的 validator）从具体路径导入，不在此整体 re-export。
 */
export * from "./constants";
export * from "./types/index";
export * from "./validation/index";
