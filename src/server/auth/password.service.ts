/**
 * @file password.service.ts
 * @description 密码哈希服务。基于 bcryptjs，盐轮数取环境配置 BCRYPT_SALT_ROUNDS；
 * hash 用于注册/改密落库，compare 用于登录校验（含 DUMMY_PASSWORD_HASH 时序防护比较）。
 */
import "server-only";
import bcrypt from "bcryptjs";
import { env } from "@server/common/config/env";
import type { PasswordService } from "@shared";

export type { PasswordService };

/**
 * bcrypt 密码服务实现
 */
export const passwordService: PasswordService = {
  /**
   * 对明文密码做 bcrypt 哈希
   * @param password 明文密码
   * @returns 哈希串（含盐与轮数信息）
   */
  hash: (password) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS),

  /**
   * 校验明文密码与哈希是否匹配（恒定时间比较）
   * @param password 用户输入的明文密码
   * @param hash 库中存储的 bcrypt 哈希
   * @returns 是否匹配
   */
  compare: (password, hash) => bcrypt.compare(password, hash),
};
