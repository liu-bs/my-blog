/**
 * @file PostStateProvider.tsx
 * @description 文章详情页状态容器：通过 Context 共享当前文章数据与更新方法，
 *              供点赞/收藏、评论区等子组件在客户端同步计数（如评论数、浏览量）；
 *              挂载时本地预增一次浏览量以即时反馈（真实上报由 ViewReporter 负责）
 */
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@shared";

/**
 * 文章状态上下文值
 */
export interface PostStateValue {
  /** 当前文章数据（客户端可变副本，初始来自服务端注入） */
  post: Post;

  /** 更新文章数据（点赞/收藏/评论数等客户端同步入口） */
  updatePost: (updater: (post: Post) => Post) => void;
}

/** 文章状态 Context，未包裹 Provider 时为 null */
const PostStateContext = createContext<PostStateValue | null>(null);

/**
 * PostStateProvider 文章状态容器
 * @param initialPost 服务端注入的文章初始数据
 * @param children 页面子节点（点赞栏、评论区等消费方）
 */
export function PostStateProvider({
  initialPost,
  children,
}: {
  /** 服务端注入的文章初始数据 */
  initialPost: Post;

  /** 页面子节点 */
  children: React.ReactNode;
}) {
  /** 文章客户端状态：子组件的计数变更均经 updatePost 同步到这里 */
  const [post, setPost] = useState<Post>(initialPost);

  /** 浏览量本地预增标记：StrictMode/重渲染下只增一次 */
  const viewIncremented = useRef(false);

  /**
   * 挂载时本地预增浏览量做即时反馈；真实去重上报由 ViewReporter 负责，此处不发起请求
   */
  useEffect(() => {
    if (viewIncremented.current) return;
    viewIncremented.current = true;
    setPost((prev) => ({ ...prev, views: prev.views + 1 }));
  }, []);

  /** Context 值随 post 变化重建，updatePost 即 setPost */
  const value = useMemo(() => ({ post, updatePost: setPost }), [post]);

  return <PostStateContext.Provider value={value}>{children}</PostStateContext.Provider>;
}

/**
 * 读取文章状态上下文，必须在 PostStateProvider 内使用
 * @returns 文章数据与更新方法
 * @throws 在 Provider 外调用时抛出错误
 */
export function usePostState(): PostStateValue {
  const ctx = useContext(PostStateContext);
  if (!ctx) throw new Error("usePostState 必须在 PostStateProvider 内使用");
  return ctx;
}
