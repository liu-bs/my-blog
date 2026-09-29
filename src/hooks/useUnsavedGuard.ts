/**
 * @file useUnsavedGuard.ts
 * @description 未保存内容守卫 Hook：脏数据存在时不直接执行可能丢失内容的动作，改为先弹确认框，由用户决定是否放弃
 */
"use client";

import { useState } from "react";

/**
 * 包装一个「可能因未保存而需要确认」的动作
 * @description 本 Hook 只负责「拦截 + 弹确认」的开关状态；确认框渲染与确认后的真正执行由调用方完成，
 * 因此可同时服务于表单取消、切换文章、离开编辑器等多种触发源
 * @param isDirty 当前表单是否有未保存改动
 * @returns confirmOpen 确认框是否打开
 * @returns setConfirmOpen 由调用方在「确认放弃」后关闭弹窗（true 用于主动打开等场景）
 * @returns guard 包装器：isDirty 为 true 时打开确认框并暂缓执行 proceed，否则直接执行 proceed
 */
export function useUnsavedGuard(isDirty: boolean): {
  /** 确认框是否可见 */
  confirmOpen: boolean;

  /** 修改确认框可见状态 */
  setConfirmOpen: (open: boolean) => void;

  /** 执行前先做脏检查的动作包装器 */
  guard: (proceed: () => void) => void;
} {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const guard = (proceed: () => void) => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    proceed();
  };

  return { confirmOpen, setConfirmOpen, guard };
}
