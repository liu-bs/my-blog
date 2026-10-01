/**
 * @file useDismissable.ts
 * @description 可关闭浮层 Hook：open 期间监听 Esc 键与外部点击触发关闭，可选锁定 body 滚动；refs/onClose 经 ref 持有，监听器只随 open 增删
 */
"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 浮层关闭行为配置
 */
interface DismissableOptions {
  /** 打开期间是否锁定 body 滚动 */
  lockScroll?: boolean;
}

/**
 * 可关闭浮层行为 Hook
 * @param open 浮层是否打开
 * @param onClose 关闭回调（Esc/外部点击触发）
 * @param refs 浮层内容容器的 Ref 列表，点击落在其中视为内部点击
 * @param options 可选配置，如锁定滚动
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
  options?: DismissableOptions,
) {
  /** 最新 refs 缓存，避免监听器依赖频繁变化 */
  const savedRefs = useRef(refs);

  /** 最新关闭回调缓存 */
  const savedOnClose = useRef(onClose);

  /** 每次渲染同步最新 refs 与 onClose 到 ref，监听器始终读到最新值 */
  useEffect(() => {
    savedRefs.current = refs;
    savedOnClose.current = onClose;
  });
  const lockScroll = options?.lockScroll;

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") savedOnClose.current();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!savedRefs.current.some((r) => r.current?.contains(target))) {
        savedOnClose.current();
      }
    };

    const prevOverflow = lockScroll ? document.body.style.overflow : undefined;
    if (lockScroll) document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      // 关闭时恢复滚动锁并解绑监听器
      if (lockScroll) document.body.style.overflow = prevOverflow!;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, lockScroll]);
}
