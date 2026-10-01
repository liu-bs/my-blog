/**
 * @file toast.ts
 * @description 全局 toast 提示封装（基于 sonner）：按创建/更新/删除操作生成多语言成功文案，错误统一经 errorToMsg 归一化
 */
"use client";

import { toast as sonner } from "sonner";
import { currentMsgLocale, entityName, errorToMsg, msg, type EntityKey } from "@/lib/message";

/**
 * 全局 toast 方法集合
 */
export const notify = {
  /** 创建成功提示，entity 为实体名词条键 */
  created(entity: EntityKey): void {
    sonner.success(msg("create", "success", { entity: entityName(entity) }));
  },

  /** 更新成功提示 */
  updated(entity: EntityKey): void {
    sonner.success(msg("update", "success", { entity: entityName(entity) }));
  },

  /** 删除成功提示 */
  deleted(entity: EntityKey): void {
    sonner.success(msg("delete", "success", { entity: entityName(entity) }));
  },

  /** 错误提示，文案按错误类型/状态码归一化 */
  error(err: unknown, fallback?: string): void {
    sonner.error(errorToMsg(err, currentMsgLocale(), fallback));
  },

  /** 通用成功提示 */
  success(text: string): void {
    sonner.success(text);
  },

  /** 通用失败提示 */
  fail(text: string): void {
    sonner.error(text);
  },

  /** 通用信息提示 */
  info(text: string): void {
    sonner.info(text);
  },
};
