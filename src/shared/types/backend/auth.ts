/**
 * @file auth.ts
 * @description 服务端认证基础设施类型：token 校验结果、Token 与密码服务的接口契约，
 *              供具体实现（JWT/bcrypt 等）与服务端调用方解耦
 */
import type { AuthPayload } from "../user";

/**
 * token 校验结果：成功携带载荷，失败区分过期与非法
 */
export type TokenVerifyResult =
  { success: true; payload: AuthPayload } | { success: false; errorType: "expired" | "invalid" };

/**
 * Token 服务接口：签发、校验与解码认证令牌
 */
export interface TokenService {
  /** 依据认证载荷签发 token 字符串 */
  generate(payload: AuthPayload): string;

  /** 校验 token 有效性，区分过期/非法两种失败原因 */
  verify(token: string): TokenVerifyResult;

  /** 解码 token 载荷，不校验有效性（如仅读取身份信息），失败返回 null */
  decode(token: string): AuthPayload | null;
}

/**
 * 密码服务接口：明文密码的哈希与比对
 */
export interface PasswordService {
  /** 对明文密码做单向哈希（含加盐） */
  hash(password: string): Promise<string>;

  /** 比对明文密码与哈希是否匹配 */
  compare(password: string, hash: string): Promise<boolean>;
}
