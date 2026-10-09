/**
 * @file PostStateProvider.tsx
 * @description 文章详情页共享状态 Provider：以 Context 持有当前文章数据，向互动区（PostActions）、
 * 统计条（PostHeadStats）、评论区（CommentsSection 经 usePostPageAuth）等子组件广播 post 并提供
 * updatePost 局部更新能力；挂载时自动将浏览量 +1（乐观展示，实际上报由 ViewReporter 完成）。
 */
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@shared";

/**
 * PostStateContext 暴露的值
 */
export interface PostStateValue {
  /** 当前文章数据（含乐观更新后的计数） */
  post: Post;

  /** 以函数式 updater 局部更新文章数据 */
  updatePost: (updater: (post: Post) => Post) => void;
}

const PostStateContext = createContext<PostStateValue | null>(null);

/**
 * 文章状态 Provider
 * @param initialPost 服务端传入的初始文章数据
 * @param children 子组件树
 */
export function PostStateProvider({
  initialPost,
  children,
}: {
  /** 服务端传入的初始文章数据 */
  initialPost: Post;

  /** 子组件树 */
  children: React.ReactNode;
}) {
  const [post, setPost] = useState<Post>(initialPost);

  /** 浏览量自增仅执行一次的标记（防 StrictMode/重渲染重复 +1） */
  const viewIncremented = useRef(false);

  /**
   * 挂载时乐观地将 views +1，立即反映在头部统计条
   */
  useEffect(() => {
    if (viewIncremented.current) return;
    viewIncremented.current = true;
    setPost((prev) => ({ ...prev, views: prev.views + 1 }));
  }, []);

  const value = useMemo(() => ({ post, updatePost: setPost }), [post]);

  return <PostStateContext.Provider value={value}>{children}</PostStateContext.Provider>;
}

/**
 * 读取/更新当前文章状态
 * @returns {@link PostStateValue}
 * @throws 在 PostStateProvider 之外调用时抛出错误
 */
export function usePostState(): PostStateValue {
  const ctx = useContext(PostStateContext);
  if (!ctx) throw new Error("usePostState 必须在 PostStateProvider 内使用");
  return ctx;
}
