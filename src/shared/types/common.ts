/**
 * @file common.ts
 * @description 通用响应类型。定义后端 API 的 JSON 响应信封，是前端 `request` 封装判断成功与否的依据。
 */

/**
 * 统一 API 响应体
 * @description 服务端所有 JSON 接口的外层信封，前端据 `code` 判定业务成功（0 为成功），
 *              并根据 `message` 决定是否弹出错误提示；错误响应同样复用该结构。
 * @typeParam T `data` 的业务数据类型
 */
export interface ApiResponse<T> {
  /** 业务状态码，0 表示成功，非 0 表示失败 */
  code: number;

  /** 业务数据，失败时通常为 null 或无意义值 */
  data: T;

  /** 提示文案，成功时可能为空，失败时为错误原因 */
  message?: string;
}
