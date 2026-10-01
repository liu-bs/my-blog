/**
 * @file useUnsavedGuard.ts
 * @description 未保存更改守卫 Hook：存在未保存修改时拦截继续操作并打开确认弹窗，确认后再放行目标动作
 */
"use client";

import { useState } from "react";

/**
 * 未保存更改守卫 Hook
 * @param isDirty 是否存在未保存修改
 * @returns 确认弹窗状态与守卫方法
 */
export function useUnsavedGuard(isDirty: boolean): {
  /** 确认弹窗是否打开 */
  confirmOpen: boolean;

  /** 设置确认弹窗开关 */
  setConfirmOpen: (open: boolean) => void;

  /** 守卫方法：脏状态时打开弹窗，否则直接放行 */
  guard: (proceed: () => void) => void;
} {
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** 拦截继续操作：有未保存修改时先打开确认弹窗 */
  const guard = (proceed: () => void) => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    proceed();
  };

  return { confirmOpen, setConfirmOpen, guard };
}
