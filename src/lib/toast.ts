/**
 * @file toast.ts
 * @description 全局提示（toast）的统一入口：封装 sonner，并把「增删改成功 / 失败」等高频场景预置成带 i18n 文案的语义化方法
 */
"use client";

import { toast as sonner } from "sonner";
import { currentMsgLocale, entityName, errorToMsg, msg, type EntityKey } from "@/lib/message";

/**
 * 全局提示方法集合
 * @description 统一在此调用 sonner，业务侧只依赖语义方法即可，将来替换提示库或调整文案只需改这一处
 */
export const notify = {
  /**
   * 创建成功提示
   * @param entity 实体 key（如 post / comment），文案为「xx 已创建」
   */
  created(entity: EntityKey): void {
    sonner.success(msg("create", "success", { entity: entityName(entity) }));
  },

  /**
   * 更新成功提示
   * @param entity 实体 key，文案为「xx 已更新」
   */
  updated(entity: EntityKey): void {
    sonner.success(msg("update", "success", { entity: entityName(entity) }));
  },

  /**
   * 删除成功提示
   * @param entity 实体 key，文案为「xx 已删除」
   */
  deleted(entity: EntityKey): void {
    sonner.success(msg("delete", "success", { entity: entityName(entity) }));
  },

  /**
   * 错误对象提示
   * @description 文案由 errorToMsg 按状态码归类生成，纯前端错误可传 fallback 覆盖
   * @param err 捕获到的错误
   * @param fallback 无法从错误中识别状态码时的兜底文案
   */
  error(err: unknown, fallback?: string): void {
    sonner.error(errorToMsg(err, currentMsgLocale(), fallback));
  },

  /**
   * 成功提示（自定义文案）
   * @param text 已本地化好的文案
   */
  success(text: string): void {
    sonner.success(text);
  },

  /**
   * 失败提示（自定义文案）
   * @param text 已本地化好的文案
   */
  fail(text: string): void {
    sonner.error(text);
  },

  /**
   * 信息提示
   * @param text 已本地化好的文案
   */
  info(text: string): void {
    sonner.info(text);
  },
};
