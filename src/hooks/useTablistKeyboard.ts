/**
 * @file useTablistKeyboard.ts
 * @description 为 role="tablist" 分组实现 ARIA Tabs 的键盘漫游：← →（含环绕）与 Home / End 在 tab 间移动焦点，
 *              并把选中态同步给调用方；挂在容器上，靠每个按钮的 data-tab 值定位目标
 */
"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";

/**
 * 生成挂在 tablist 容器上的 onKeyDown
 * @param order 全部 tab 值的顺序数组，决定左右键的环绕次序；建议使用模块级常量以保持引用稳定
 * @param onSelect 焦点移动到新 tab 时的回调，用于同步选中面板内容
 * @returns 供容器 onKeyDown 使用的事件处理函数
 */
export function useTablistKeyboard<T extends string>(
  order: readonly T[],
  onSelect: (tab: T) => void,
): (e: KeyboardEvent) => void {
  return useCallback(
    (e: KeyboardEvent) => {
      // e.target 为当前聚焦的 tab 按钮，其 data-tab 携带 tab 值
      const current = (e.target as HTMLElement).dataset.tab as T | undefined;
      if (!current) return;
      const i = order.indexOf(current);
      if (i < 0) return;

      let next: number;
      switch (e.key) {
        case "ArrowRight":
          next = (i + 1) % order.length;
          break;
        case "ArrowLeft":
          next = (i - 1 + order.length) % order.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = order.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();

      const value = order[next];
      // noUncheckedIndexedAccess 下索引结果可能为 undefined；next 恒在 [0, len) 内，此处仅作类型收窄兜底
      if (!value) return;
      onSelect(value);
      // 按钮节点始终存在（仅 aria-selected / tabIndex 变化），按 data-tab 精确聚焦
      (e.currentTarget as HTMLElement)
        .querySelector<HTMLElement>(`[data-tab="${value}"]`)
        ?.focus();
    },
    [order, onSelect],
  );
}
