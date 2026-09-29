/**
 * @file ViewReporter.tsx
 * @description 文章浏览量上报器：客户端挂载后向服务端上报一次浏览，自身不渲染任何 DOM。
 * 之所以放在客户端而非服务端渲染时上报，是因为页面主体带缓存、且爬虫与预取也会触发 SSR，
 * 放在客户端挂载后上报更接近「真实用户打开了一次页面」
 */
"use client";

import { useEffect } from "react";
import { api } from "@/lib/apiRequest";

/** 已上报过的文章 id 集合：模块级存储可跨组件多次挂载保留，用于避免同一文章在会话内被重复计数 */
const reported = new Set<string>();

/** 去重集合的容量上限，超过后按插入顺序淘汰最旧记录，防止长时间浏览导致内存无界增长 */
const REPORTED_CAP = 50;

/**
 * ViewReporter 浏览上报组件
 * @description 在挂载后上报一次浏览量（不判断元素是否进入视口，因为文章详情页本身即浏览目标）；
 * 失败仅打印日志、不向用户暴露错误，浏览量属于非关键指标，不能因上报失败影响页面
 * @param props 组件入参
 * @param props.postId 目标文章 id；为空则不上报
 * @returns 始终渲染 null
 */
export function ViewReporter({ postId }: { postId: string }) {
  /**
   * 挂载后触发上报
   * @description 双重防重：postId 为空直接跳过；已有上报记录则跳过。
   * 关键点是在发请求「之前」就写入集合，避免请求未返回期间组件重挂载导致重复上报；
   * 超出容量上限时淘汰最旧的一条（Set 保持插入顺序，故取首个值即最旧）
   */
  useEffect(() => {
    if (!postId || reported.has(postId)) return;

    if (reported.size >= REPORTED_CAP) {
      const oldest = reported.values().next().value;
      if (oldest !== undefined) reported.delete(oldest);
    }
    reported.add(postId);

    // 失败静默：仅记录日志便于排查，浏览量缺失不影响阅读体验，故不重试、不提示用户（服务端会忽略草稿）
    api.post<null>(`/posts/${postId}/view`).catch((err) => {
      console.error(`[ViewReporter] view report failed for ${postId}`, err);
    });
  }, [postId]);
  return null;
}
