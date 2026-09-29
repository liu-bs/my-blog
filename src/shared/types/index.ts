/**
 * @file index.ts
 * @description 共享类型层的统一出口，按领域拆分成多个子模块后逐个重导出：
 *              `common` 是通用响应包装，`action` 是 Server Action 的结果契约，
 *              其余依次为 user / blog / comment / ui，以及服务端专属（backend）与客户端专属（frontend）类型。
 * @warning 重导出会让同名类型彼此覆盖，调整导出顺序或新增同名导出前需评估前后端两侧的影响
 */
export * from "./common";
export * from "./action";
export * from "./user";
export * from "./blog";
export * from "./comment";
export * from "./ui";
export * from "./backend";
export * from "./frontend";
