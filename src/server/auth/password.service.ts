/**
 * @file password.service.ts
 * @description 密码哈希与校验服务，基于 bcryptjs。注册与改密时用 hash 生成不可逆哈希，登录与改密校验时用 compare 做恒定时间比对
 */
import "server-only";
import bcrypt from "bcryptjs";
import { env } from "@server/common/config/env";
import type { PasswordService } from "@shared";

export type { PasswordService };

/**
 * bcrypt 密码服务实现
 * @description salt rounds 取自环境变量 BCRYPT_SALT_ROUNDS（默认 10），轮数越高越难被暴力破解，但单次耗时线性增长；
 * compare 内部为恒定时间比较，避免攻击者通过响应耗时逐字节推测密码
 */
export const passwordService: PasswordService = {
  /** 生成密码哈希（每次调用自动加随机盐，同一密码结果不同） */
  hash: (password) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS),
  /** 校验明文密码与数据库中的哈希是否匹配 */
  compare: (password, hash) => bcrypt.compare(password, hash),
};
