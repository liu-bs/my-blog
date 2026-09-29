/**
 * @file useDismissable.ts
 * @description 浮层（弹窗、下拉菜单等）的通用「可关闭」行为：ESC 关闭、点击浮层外部关闭，并可选的锁定 body 滚动
 */
"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * useDismissable 的可选配置
 */
interface DismissableOptions {
  /** 打开时是否锁定 body 滚动（如模态框），关闭/卸载时还原为打开前的值 */
  lockScroll?: boolean;
}

/**
 * 为浮层挂载关闭交互
 * @description 事件监听仅在 open 为 true 时注册，关闭即移除，避免常驻监听；点击判定采用「命中任一受保护容器即视为内部点击」，
 * 因此浮层与其触发按钮都应放进 refs 里，否则点击触发按钮会先被判定为外部点击而立即关闭
 * @param open 浮层是否打开；由 false 变 true 时注册监听，变 false 或组件卸载时移除
 * @param onClose 关闭回调；内部用 ref 保存，调用方不必为它做 useCallback
 * @param refs 需要被视为「浮层内部」的元素引用数组，点击这些元素或其子孙时不触发 onClose
 * @param options 可选配置 {@link DismissableOptions}
 * @warning 滚动锁定直接改写 document.body.style.overflow，若多个浮层叠加需由调用方保证不会互相覆盖
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
  options?: DismissableOptions,
) {
  /** refs 的实时引用，使监听逻辑无需因 refs 变化而重新绑定 */
  const savedRefs = useRef(refs);
  /** onClose 的实时引用，规避闭包陈旧 */
  const savedOnClose = useRef(onClose);

  /** 每次渲染同步最新入参 */
  useEffect(() => {
    savedRefs.current = refs;
    savedOnClose.current = onClose;
  });
  const lockScroll = options?.lockScroll;

  useEffect(() => {
    if (!open) return;

    /** ESC 键关闭 */
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") savedOnClose.current();
    };
    /** 点击浮层外部关闭 */
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!savedRefs.current.some((r) => r.current?.contains(target))) {
        savedOnClose.current();
      }
    };

    // 记录打开前的 inline overflow，以便关闭时精确还原（可能本身就有其他值）
    const prevOverflow = lockScroll ? document.body.style.overflow : undefined;
    if (lockScroll) document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      // 清理：还原滚动并移除两个监听
      if (lockScroll) document.body.style.overflow = prevOverflow!;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, lockScroll]);
}
