/**
 * @file useTablistKeyboard.ts
 * @description Tablist（标签栏）键盘导航 Hook：实现 WAI-ARIA Tabs 规范的左右箭头循环切换、Home/End 跳转首尾标签
 */
"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";

/**
 * 生成 tablist 容器的 onKeyDown 处理器
 * @param order 标签值数组，定义左右导航顺序
 * @param onSelect 选中某标签时的回调（切换内容面板）
 * @returns 绑定到 tablist 的键盘事件处理器；非导航按键与未知 target 直接忽略
 * @warning 依赖标签按钮上的 data-tab 属性标记自身值，且需渲染在同一容器内以便 querySelector 定位聚焦
 * @example const onKeyDown = useTablistKeyboard(["posts", "comments"], setTab); // <div role="tablist" onKeyDown={onKeyDown}>
 */
export function useTablistKeyboard<T extends string>(
  order: readonly T[],
  onSelect: (tab: T) => void,
): (e: KeyboardEvent) => void {
  return useCallback(
    (e: KeyboardEvent) => {
      // 从事件目标读取 data-tab 标记的当前标签值
      const current = (e.target as HTMLElement).dataset.tab as T | undefined;
      if (!current) return;
      const i = order.indexOf(current);
      if (i < 0) return;

      let next: number;
      switch (e.key) {
        case "ArrowRight":
          // 向右循环到首个标签
          next = (i + 1) % order.length;
          break;
        case "ArrowLeft":
          // 向左循环到末尾标签
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

      if (!value) return;
      onSelect(value);

      // 焦点跟随移动到新选中的标签按钮
      (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${value}"]`)?.focus();
    },
    [order, onSelect],
  );
}
