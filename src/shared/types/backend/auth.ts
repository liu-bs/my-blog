/**
 * @file auth.ts
 * @description 服务端认证底层能力接口：令牌服务与密码服务。以接口形式声明是为了把
 *              「JWT 签发/校验」「密码哈希/比对」抽象出来，实现（如 token.service、bcrypt）可替换、便于测试。
 */
import type { AuthPayload } from "../user";

/**
 * 令牌校验结果
 * @description 判别联合：成功时携带解出的载荷；失败时用 `errorType` 区分「已过期」与「非法」，
 *              以便上层分别给出「登录已过期请重新登录」与「登录状态异常」两类提示
 */
export type TokenVerifyResult =
  { success: true; payload: AuthPayload } | { success: false; errorType: "expired" | "invalid" };

/**
 * 令牌服务接口
 * @description 实现需为无状态 JWT：令牌自包含载荷，服务端不保存会话
 */
export interface TokenService {
  /**
   * 签发令牌
   * @param payload 令牌载荷，至少含用户 id 与 tokenVersion
   * @returns 签名后的 JWT 字符串
   */
  generate(payload: AuthPayload): string;

  /**
   * 校验令牌签名与有效期
   * @param token 待校验的 JWT 字符串
   * @returns 判别联合结果，区分过期与非法
   */
  verify(token: string): TokenVerifyResult;

  /**
   * 仅解码载荷（不校验签名与有效期）
   * @description 用于取到过期令牌中的信息做辅助判断，不可作为鉴权依据
   * @param token JWT 字符串
   * @returns 解码出的载荷，解析失败返回 null
   */
  decode(token: string): AuthPayload | null;
}

/**
 * 密码服务接口
 * @description 明文密码只在此处进出，调用方不应自行处理哈希
 */
export interface PasswordService {
  /**
   * 生成密码哈希
   * @param password 明文密码
   * @returns 可入库的哈希字符串
   */
  hash(password: string): Promise<string>;

  /**
   * 比对明文与哈希是否匹配
   * @param password 明文密码
   * @param hash 库中保存的哈希
   * @returns 匹配返回 true
   */
  compare(password: string, hash: string): Promise<boolean>;
}
