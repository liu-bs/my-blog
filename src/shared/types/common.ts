/**
 * @file common.ts
 * @description 跨模块通用的响应包装类型。REST 路由（`src/app/api/.../route.ts`，经 defineRoute 包装后）
 *              统一以 {@link ApiResponse} 结构返回 JSON，客户端 `@/lib/apiRequest` 依据 code 字段判定业务成败。
 */

/**
 * REST 接口通用响应包装
 * @template T 业务数据类型
 */
export interface ApiResponse<T> {
  /** 业务状态码：0 表示成功，非 0 表示业务/服务端错误（客户端以 code === 0 判定成功） */
  code: number;

  /** 业务数据载荷，失败时通常为 null 或空对象 */
  data: T;

  /** 提示信息：成功时可省略，失败时为可读的错误文案，用于 toast 展示 */
  message?: string;
}
