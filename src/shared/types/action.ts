/**
 * @file action.ts
 * @description Server Action 的统一返回契约。所有写操作（增删改）都以该判别联合作为返回值，
 *              调用方先判断 `ok` 再取数据，不依赖抛异常来表达可预期的业务失败（如校验不通过、未登录）。
 */
import type { ValidationErrorDetail } from "./ui";

/**
 * Server Action 执行结果
 * @description 判别联合：`ok` 为 true 时业务成功并携带数据；为 false 时携带 HTTP 状态码与可展示文案。
 *              用返回值而非 throw 表达失败，便于客户端直接 `if (!res.ok)` 分支处理。
 * @typeParam T 成功分支中 `data` 的业务数据类型
 */
export type ActionResult<T> =
  /** 成功分支：`data` 为 action 产出的业务数据 */
  | { ok: true; data: T }
  /**
   * 失败分支
   * - `status`：HTTP 语义状态码，前端据此区分 401 未登录 / 403 无权限 / 422 字段校验失败等分支
   * - `message`：可直接展示给用户的错误文案
   * - `details`：仅字段级校验失败时存在，供表单把错误回填到具体输入框
   */
  | { ok: false; status: number; message: string; details?: ValidationErrorDetail[] };
