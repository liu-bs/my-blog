/**
 * @file token.service.ts
 * @description JWT 签发与校验服务。固定 HS256 算法并校验 issuer/audience，
 * verify 返回结构化结果（区分过期与无效）而不抛错，供认证流程按类型处理刷新与拒绝。
 */
import "server-only";
import jwt from "jsonwebtoken";
import { env } from "@server/common/config/env";
import type { AuthPayload, TokenVerifyResult, TokenService } from "@shared";

export type { AuthPayload };
export type { TokenVerifyResult, TokenService };

/** JWT 签名算法，显式固定以防算法混淆攻击 */
const ALGORITHM = "HS256" as const;

/** JWT issuer 声明 */
const ISSUER = "my-app";

/** JWT audience 声明 */
const AUDIENCE = "my-app-web";

/**
 * JWT 令牌服务实现
 */
export const tokenService: TokenService = {
  /**
   * 签发 JWT，有效期取环境配置 JWT_EXPIRES_IN
   * @param payload 认证载荷（仅含用户 id 与 tokenVersion）
   * @returns 签名后的 token 字符串
   */
  generate: (payload) => {
    const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn,
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  },

  /**
   * 校验 JWT 签名、有效期及 issuer/audience
   * @param token 待校验的 token
   * @returns 成功时携带载荷；失败时区分 expired（已过期）与 invalid（签名/格式错误）
   */
  verify: (token) => {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as AuthPayload;
      return { success: true, payload };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return { success: false, errorType: "expired" };
      }
      return { success: false, errorType: "invalid" };
    }
  },

  /**
   * 无签名校验地解码 JWT 载荷（不校验有效性与 tokenVersion）
   * @param token 待解码的 token
   * @returns 载荷对象，无法解析时为 null
   */
  decode: (token) => jwt.decode(token) as AuthPayload | null,
};
