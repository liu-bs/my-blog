/**
 * @file useTablistKeyboard.ts
 * @description Tab 列表键盘导航 Hook：实现 WAI-ARIA tabs 键盘交互（左右箭头循环切换、Home/End 首尾跳转），选中后聚焦对应 tab 元素
 */
"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";

/**
 * 创建 tablist 键盘事件处理函数
 * @param order tab 值的顺序，与 DOM 中 data-tab 一致
 * @param onSelect 选中回调，入参为目标 tab 值
 * @returns 键盘事件处理函数，绑定到 tablist 容器
 */
export function useTablistKeyboard<T extends string>(
  order: readonly T[],
  onSelect: (tab: T) => void,
): (e: KeyboardEvent) => void {
  return useCallback(
    (e: KeyboardEvent) => {
      // 当前聚焦元素通过 data-tab 标识定位其在顺序中的位置
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

      // 选中目标 tab 并移动焦点
      if (!value) return;
      onSelect(value);

      (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${value}"]`)?.focus();
    },
    [order, onSelect],
  );
}
