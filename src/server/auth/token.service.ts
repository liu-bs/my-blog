import "server-only";

/**
 * @file JWT token 服务
 * @description 封装 jsonwebtoken：签发/验签认证 token。固定 HS256 并校验 issuer/audience，
 * 防止算法混淆与跨系统 token 串用；verify 不抛错，以判别联合结果（expired/invalid）区分失效原因。
 */
import jwt from "jsonwebtoken";
import { env } from "@server/common/config/env";
import type { AuthPayload, TokenVerifyResult, TokenService } from "@shared";

export type { AuthPayload };
export type { TokenVerifyResult, TokenService };

/** 签名算法：仅允许 HS256，验签时白名单固定 */
const ALGORITHM = "HS256" as const;

/** token 签发者标识，验签时强制匹配 */
const ISSUER = "my-app";

/** token 受众标识，防止其他系统签发的同类 token 被复用 */
const AUDIENCE = "my-app-web";

/**
 * token 服务单例
 * generate：签发带过期时间的 JWT；verify：验签并返回结果联合类型；decode：不验签仅解析（仅供调试/兜底场景）
 */
export const tokenService: TokenService = {
  generate: (payload) => {
    const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn,
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  },

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

  decode: (token) => jwt.decode(token) as AuthPayload | null,
};
