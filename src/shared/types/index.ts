/**
 * @file index.ts（共享类型统一出口）
 * @description 聚合转发 common、action、user、blog、comment、ui 及 backend/、frontend/ 子目录下的全部共享类型。
 *              服务端（Server Action、REST route、service 层）与客户端组件均通过 `@shared` 别名引用，
 *              保证前后端对同一业务实体的类型定义只维护一份。
 */
export * from "./common";
export * from "./action";
export * from "./user";
export * from "./blog";
export * from "./comment";
export * from "./ui";
export * from "./backend";
export * from "./frontend";
