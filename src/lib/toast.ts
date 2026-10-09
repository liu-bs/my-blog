/**
 * @file toast.ts
 * @description 全局 toast 通知封装：基于 sonner，将实体增删改成功、错误等场景映射为统一中文文案；仅限客户端使用
 */
"use client";

import { toast as sonner } from "sonner";
import { formatTemplate, messages } from "@/texts";
import { entityName, errorToMsg, type EntityKey } from "@/lib/message";

/** 统一通知入口，方法均为 fire-and-forget，无返回值 */
export const notify = {
  /**
   * 创建成功提示，如 "帖子已创建"
   * @param entity 实体 key {@link EntityKey}
   */
  created(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.create.success, { entity: entityName(entity) }),
    );
  },

  /**
   * 更新成功提示
   * @param entity 实体 key {@link EntityKey}
   */
  updated(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.update.success, { entity: entityName(entity) }),
    );
  },

  /**
   * 删除成功提示
   * @param entity 实体 key {@link EntityKey}
   */
  deleted(entity: EntityKey): void {
    sonner.success(
      formatTemplate(messages.feedback.delete.success, { entity: entityName(entity) }),
    );
  },

  /**
   * 错误提示：经 errorToMsg 将错误对象映射为可读文案
   * @param err 任意抛出物（通常带 status）
   * @param fallback 无 status 时的兜底文案
   */
  error(err: unknown, fallback?: string): void {
    sonner.error(errorToMsg(err, fallback));
  },

  /**
   * 直接展示成功文案
   * @param text 完整文案
   */
  success(text: string): void {
    sonner.success(text);
  },

  /**
   * 直接展示失败文案
   * @param text 完整文案
   */
  fail(text: string): void {
    sonner.error(text);
  },

  /**
   * 直接展示中性提示
   * @param text 完整文案
   */
  info(text: string): void {
    sonner.info(text);
  },
};
