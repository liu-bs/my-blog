/**
 * @file ViewReporter.tsx
 * @description 浏览量上报隐形组件：挂载后向后端 POST /posts/:id/view 上报一次浏览，
 * 模块级 Set 去重防止同页重复上报（缓存上限 50 条，超出按插入顺序淘汰最旧）。
 * 自身不渲染任何 DOM，放在文章页内即生效。
 */
"use client";

import { useEffect } from "react";
import { api } from "@/lib/apiRequest";

/** 已上报过浏览的文章ID集合（模块级，SPA 生命周期内去重） */
const reported = new Set<string>();

/** 去重集合容量上限，超出后淘汰最早加入的ID */
const REPORTED_CAP = 50;

/**
 * 浏览量上报组件
 * @param postId 文章ID
 * @warning 上报失败仅打印控制台日志，不重试、不影响页面展示
 */
export function ViewReporter({ postId }: { postId: string }) {
  /**
   * 每个 postId 只上报一次；集合达到上限时先淘汰最旧一条再写入
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
