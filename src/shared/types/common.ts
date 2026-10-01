/**
 * @file common.ts
 * @description 通用网络响应类型：后端 API 的统一响应包裹结构
 */

/**
 * 后端 API 统一响应结构
 */
export interface ApiResponse<T> {
  /** 业务状态码，0 或 200 表示成功，具体含义视后端约定 */
  code: number;

  /** 响应数据载荷 */
  data: T;

  /** 附加消息，通常在失败时携带错误描述 */
  message?: string;
}
