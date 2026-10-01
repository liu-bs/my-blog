/**
 * @file ViewReporter.tsx
 * @description 文章浏览量上报组件（无渲染）：挂载后向 /posts/[id]/view 上报一次浏览；
 *              用模块级 Set 做同会话去重（容量上限 50，满后 FIFO 淘汰最早记录），防止同一文章重复计数
 */
"use client";

import { useEffect } from "react";
import { api } from "@/lib/apiRequest";

/** 已上报文章ID集合（模块级，跨组件实例共享），实现同会话去重 */
const reported = new Set<string>();

/** 去重集合容量上限，防止长会话内存无限增长 */
const REPORTED_CAP = 50;

/**
 * ViewReporter 浏览量上报
 * @param postId 文章ID
 * @returns null，纯副作用组件不渲染任何内容
 */
export function ViewReporter({ postId }: { postId: string }) {
  /**
   * 挂载时上报一次浏览：命中去重集合则跳过；
   * 集合满时先淘汰最早插入的记录（Set 迭代顺序即插入顺序）再登记本次
   */
  useEffect(() => {
    if (!postId || reported.has(postId)) return;

    if (reported.size >= REPORTED_CAP) {
      const oldest = reported.values().next().value;
      if (oldest !== undefined) reported.delete(oldest);
    }
    reported.add(postId);

    api.post<null>(`/posts/${postId}/view`).catch((err) => {
      console.error(`[ViewReporter] view report failed for ${postId}`, err);
    });
  }, [postId]);
  return null;
}
