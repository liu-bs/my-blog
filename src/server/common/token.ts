import "server-only";

import jwt from "jsonwebtoken";
import type { AuthPayload } from "@shared";
import { env } from "@server/common/config/env";

export type TokenVerifyResult =
  { isValid: true; payload: AuthPayload } | { isValid: false; isExpired: boolean };

const ALGORITHM = "HS256" as const;

const ISSUER = "my-app";

const AUDIENCE = "my-app-web";

export function signToken(payload: Pick<AuthPayload, "id" | "tokenVersion">): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    algorithm: ALGORITHM,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyToken(token: string): TokenVerifyResult {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as AuthPayload;
    return { isValid: true, payload };
  } catch (err) {
    return { isValid: false, isExpired: err instanceof jwt.TokenExpiredError };
  }
}

export function decodeToken(token: string): AuthPayload | null {
  return jwt.decode(token) as AuthPayload | null;
}
