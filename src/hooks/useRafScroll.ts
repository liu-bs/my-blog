/**
 * @file useRafScroll.ts
 * @description 滚动监听 Hook：用 requestAnimationFrame 合并滚动事件，每帧最多回调一次，传入当前滚动位置与文档剩余可滚动高度；回调经 ref 持有，监听器只绑定一次
 */
"use client";

import { useEffect, useRef } from "react";

/**
 * 滚动监听 Hook
 * @param onScroll 滚动帧回调，入参为 scrollY 与文档总可滚动高度（scrollHeight - innerHeight）
 */
export function useRafScroll(onScroll: (scrollY: number, docHeight: number) => void) {
  /** 最新回调缓存，监听器只绑定一次 */
  const savedCb = useRef(onScroll);

  /** 每次渲染同步最新回调到 ref */
  useEffect(() => {
    savedCb.current = onScroll;
  });

  useEffect(() => {
    /** 帧合并标记：本帧已有待执行回调时跳过 */
    let ticking = false;

    /** 滚动事件处理：rAF 帧内合并执行，passive 监听不阻塞滚动 */
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        savedCb.current(window.scrollY, document.documentElement.scrollHeight - window.innerHeight);
        ticking = false;
      });
    };

    window.addEventListener("scroll", handler, { passive: true });

    // 挂载时先执行一次，同步初始滚动状态
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);
}
