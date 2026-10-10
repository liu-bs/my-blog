import "server-only";

import bcrypt from "bcryptjs";
import { env } from "@server/common/config/env";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
