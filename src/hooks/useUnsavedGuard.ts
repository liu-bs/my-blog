/**
 * @file useUnsavedGuard.ts
 * @description 未保存变更守卫 Hook：存在脏数据时拦截导航/切换等操作并打开确认弹窗，否则直接放行
 */
"use client";

import { useState } from "react";

/**
 * 未保存守卫
 * @param isDirty 当前表单是否存在未保存修改
 * @returns confirmOpen（弹窗开关状态）、setConfirmOpen（设置开关）、guard（拦截函数），见返回结构字段注释
 * @example guard(() => router.push("/posts")) // 有未保存内容时改为弹出确认框
 */
export function useUnsavedGuard(isDirty: boolean): {
  /** 确认弹窗是否打开 */
  confirmOpen: boolean;

  /** 设置确认弹窗开关（用户在弹窗中确认/取消后调用） */
  setConfirmOpen: (open: boolean) => void;

  /** 守卫函数：isDirty 时打开弹窗并拦截，否则立即执行 proceed */
  guard: (proceed: () => void) => void;
} {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const guard = (proceed: () => void) => {
    if (isDirty) {
      // 脏数据：拦截跳转，改为打开确认弹窗
      setConfirmOpen(true);
      return;
    }
    proceed();
  };

  return { confirmOpen, setConfirmOpen, guard };
}
