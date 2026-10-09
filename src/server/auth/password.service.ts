import "server-only";

/**
 * @file 密码服务（bcrypt 实现）
 * @description 提供密码哈希与比对能力，salt 轮数由环境变量 BCRYPT_SALT_ROUNDS 控制；
 * 全项目只经由该服务处理密码，业务层不直接依赖 bcryptjs。
 */
import bcrypt from "bcryptjs";
import { env } from "@server/common/config/env";
import type { PasswordService } from "@shared";

export type { PasswordService };

/**
 * 密码服务单例
 * hash：生成 bcrypt 哈希（轮数取 env.BCRYPT_SALT_ROUNDS）；
 * compare：恒定时比对明文与哈希，登录/改密校验均使用它
 */
export const passwordService: PasswordService = {
  hash: (password) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS),

  compare: (password, hash) => bcrypt.compare(password, hash),
};
