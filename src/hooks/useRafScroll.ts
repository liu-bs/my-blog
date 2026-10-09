/**
 * @file useRafScroll.ts
 * @description 基于 requestAnimationFrame 节流的滚动监听 Hook：每帧最多执行一次回调，挂载时立即执行一次初始化滚动位置
 */
"use client";

import { useEffect, useRef } from "react";

/**
 * RAF 节流滚动 Hook
 * @param onScroll 滚动回调：scrollY 为当前垂直滚动距离，docHeight 为文档可滚动总高度（scrollHeight - 视口高）
 * @warning 监听为 passive 且仅在挂载时订阅一次；回调经 ref 持久化，组件内闭包状态变化无需重新订阅
 */
export function useRafScroll(onScroll: (scrollY: number, docHeight: number) => void) {
  /** 持久化最新回调，避免 effect 依赖变化重复绑定 scroll 监听 */
  const savedCb = useRef(onScroll);

  useEffect(() => {
    savedCb.current = onScroll;
  });

  useEffect(() => {
    // RAF 节流标记：一帧内多次 scroll 事件只处理最后一次
    let ticking = false;

    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        savedCb.current(window.scrollY, document.documentElement.scrollHeight - window.innerHeight);
        ticking = false;
      });
    };

    window.addEventListener("scroll", handler, { passive: true });

    // 挂载立即执行一次，同步初始滚动位置（如刷新后页面在中部）
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);
}
