"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";

export function useTabListKeyboard<T extends string>(
  order: readonly T[],
  onSelect: (tab: T) => void,
): (e: KeyboardEvent) => void {
  return useCallback(
    (e: KeyboardEvent) => {
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

      if (!value) return;
      onSelect(value);

      (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${value}"]`)?.focus();
    },
    [order, onSelect],
  );
}
