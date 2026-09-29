/**
 * @file index.ts
 * @description 共享层（`@shared`）总出口：聚合 `types` 类型定义与 `validation` zod schema，
 *              是前端组件 / hook 与服务端 Controller / Validator 共同的引用入口。
 * @warning 本文件是前后端双向依赖的汇聚点，增删导出会同时影响两侧编译，改动前需确认两端的引用情况
 */
export * from "./types/index";
export * from "./validation/index";
