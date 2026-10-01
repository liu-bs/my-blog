/**
 * @file index.ts
 * @description shared 模块 barrel：只 re-export 类型（types）与 zod-runtime-free 的校验工具
 *              （primitives/postId）。含 zod schema 的业务模块（validation/auth、comment、blog）
 *              禁止从这里 re-export——使用方必须按模块路径直接 import，
 *              防止 zod 全量核心被打进客户端 chunk
 */
export * from "./types/index";
export * from "./validation/index";
