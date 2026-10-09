/**
 * @file useDismissable.ts
 * @description 弹层/下拉等"可关闭"组件的通用关闭行为 Hook：Esc 键关闭 + 点击区域外关闭，可选锁定页面滚动。仅限客户端使用。
 */
"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * useDismissable 可选项
 */
interface DismissableOptions {
  /** 打开期间是否将 body 滚动锁定为 hidden（关闭时恢复原值），默认 false */
  lockScroll?: boolean;
}

/**
 * 点击外部/Esc 关闭 Hook
 * @param open 弹层是否处于打开态；false 时不绑定任何监听
 * @param onClose 关闭回调（经 ref 持久化，无需 useCallback）
 * @param refs 弹层自身（含触发器）的 DOM 引用数组；点击落在所有 ref 之外才触发关闭
 * @param options 可选项 {@link DismissableOptions}
 * @warning 监听挂在 document 的 mousedown 上，弹层内阻止冒泡不影响判定；refs 数组引用变化不会重新订阅（通过 ref 读取最新值）
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
  options?: DismissableOptions,
) {
  /** 持久化最新 refs，避免每次渲染重绑事件 */
  const savedRefs = useRef(refs);

  /** 持久化最新 onClose 回调 */
  const savedOnClose = useRef(onClose);

  useEffect(() => {
    savedRefs.current = refs;
    savedOnClose.current = onClose;
  });
  const lockScroll = options?.lockScroll;

  useEffect(() => {
    if (!open) return;

    // Esc 键关闭
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") savedOnClose.current();
    };

    // 点击落在所有 refs 容器之外时关闭
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!savedRefs.current.some((r) => r.current?.contains(target))) {
        savedOnClose.current();
      }
    };

    // 记录进入前的 body overflow，供卸载时恢复
    const prevOverflow = lockScroll ? document.body.style.overflow : undefined;
    if (lockScroll) document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      if (lockScroll) document.body.style.overflow = prevOverflow!;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, lockScroll]);
}
