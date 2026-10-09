/**
 * @file auth.ts（backend 子目录）
 * @description 服务端认证域抽象类型：JWT 校验结果与 Token/Password 服务接口契约。
 *              由 `src/server/auth/` 的实现（tokenService、passwordService）满足，供 controller/service 层依赖注入使用。
 */
import type { AuthPayload } from "../user";

/**
 * Token 校验结果（以 success 字段判别的联合类型）
 * @description 成功分支返回解码后的 {@link AuthPayload}；
 *              失败分支的 errorType：expired-签名有效但已过期，invalid-签名错误/格式非法/版本号失效。
 */
export type TokenVerifyResult =
  { success: true; payload: AuthPayload } | { success: false; errorType: "expired" | "invalid" };

/**
 * Token 服务接口契约（JWT 签发与校验）
 */
export interface TokenService {
  /**
   * 签发 token
   * @param payload 用户 JWT 载荷（{@link AuthPayload}），含 id 与 tokenVersion
   * @returns 序列化后的 JWT 字符串，写入认证 Cookie
   */
  generate(payload: AuthPayload): string;

  /**
   * 校验 token 的签名与有效期
   * @param token JWT 字符串
   * @returns 校验结果，见 {@link TokenVerifyResult}
   */
  verify(token: string): TokenVerifyResult;

  /**
   * 仅解码 token，不校验签名与有效期（用于取展示信息，不可用于鉴权判断）
   * @param token JWT 字符串
   * @returns 解码后的 {@link AuthPayload}，解析失败时为 null
   */
  decode(token: string): AuthPayload | null;
}

/**
 * 密码服务接口契约（哈希与比对）
 */
export interface PasswordService {
  /**
   * 对明文密码做单向哈希（含盐），用于注册与改密落库
   * @param password 明文密码
   * @returns 哈希字符串，存储于 {@link User} 的 password 字段
   */
  hash(password: string): Promise<string>;

  /**
   * 将用户输入的明文密码与存储的哈希比对（登录校验）
   * @param password 用户输入的明文密码
   * @param hash 数据库中存储的密码哈希
   * @returns 是否匹配
   */
  compare(password: string, hash: string): Promise<boolean>;
}
