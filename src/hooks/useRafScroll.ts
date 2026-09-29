/**
 * @file useRafScroll.ts
 * @description 滚动监听 Hook：把高频 scroll 事件用 requestAnimationFrame 节流为每帧至多一次回调，
 * 供阅读进度条、回到顶部按钮等场景使用
 */
"use client";

import { useEffect, useRef } from "react";

/**
 * 监听页面滚动并回调进度信息
 * @description rAF 节流：scroll 事件可能每帧触发多次，这里用 ticking 标记保证同一帧内只调度一次回调，
 * 结束后才允许下一帧再次调度，从而把回调频率收敛到显示器刷新率；监听以 passive 注册，不阻塞浏览器滚动
 * @param onScroll 回调，入参为当前纵向滚动距离 scrollY 与「可滚动总高度」（docHeight = 文档总高 - 视口高，即最大可滚动距离），单位均为像素；内部用 ref 保存最新引用，无需调用方 useCallback
 * @warning 首次挂载会立即主动调用一次 onScroll，以便初始化进度而不用等用户滚动
 */
export function useRafScroll(onScroll: (scrollY: number, docHeight: number) => void) {
  /** 回调实时引用，避免因回调变化重新绑定监听 */
  const savedCb = useRef(onScroll);

  /** 每次渲染同步最新回调 */
  useEffect(() => {
    savedCb.current = onScroll;
  });

  useEffect(() => {
    /** 本帧是否已调度回调，防止一帧内重复排队 */
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
    // 挂载即触发一次，保证初始状态正确
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);
}
