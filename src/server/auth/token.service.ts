/**
 * @file token.service.ts
 * @description JWT 令牌服务：登录后签发 HS256 令牌（载荷含用户 id 与 tokenVersion），校验时强制验签名、算法、签发方与受众
 */
import "server-only";
import jwt from "jsonwebtoken";
import { env } from "@server/common/config/env";
import type { AuthPayload, TokenVerifyResult, TokenService } from "@shared";

export type { AuthPayload };
export type { TokenVerifyResult, TokenService };

/** 签名算法，固定 HS256（对称密钥）；verify 时以白名单方式校验，防止 alg 混淆攻击 */
const ALGORITHM = "HS256" as const;
/** 令牌签发方标识，verify 时校验，拒绝其他系统签发的同密钥令牌 */
const ISSUER = "my-app";
/** 令牌受众标识，verify 时校验，限定令牌仅用于本站 Web 端 */
const AUDIENCE = "my-app-web";

/**
 * JWT 令牌服务实现
 * @description generate 把 AuthPayload（用户 id + tokenVersion）签成自包含令牌；verify 返回判别联合结果，把「已过期」与「非法」分开，便于上层给出不同提示；
 * 令牌本身无状态、无法主动撤销，全端登出与失效依赖 tokenVersion 与数据库比对实现（见 auth.service）
 */
export const tokenService: TokenService = {
  /**
   * 签发 JWT
   * @param payload 令牌载荷，至少含用户 id 与签发时的 tokenVersion
   * @returns 签名后的 JWT 字符串
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
   * 校验 JWT 并解析载荷
   * @description 同时校验签名、算法、签发方、受众与有效期；过期与非法分别归类，供调用方区分提示
   * @param token 待校验的 JWT 字符串
   * @returns 成功返回 payload；失败按 errorType 标记为 expired 或 invalid
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
   * 仅解码 JWT 载荷，不校验签名与有效期
   * @param token 待解码的 JWT
   * @returns 解码后的载荷，解码失败返回 null
   * @warning 结果不可信，仅可用于读取非敏感信息，鉴权必须使用 verify
   */
  decode: (token) => jwt.decode(token) as AuthPayload | null,
};
