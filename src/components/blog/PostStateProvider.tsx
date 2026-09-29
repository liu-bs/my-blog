/**
 * @file PostStateProvider.tsx
 * @description 文章详情页的客户端状态容器。服务端渲染时已取到文章数据，这里把它交给 Context 共享，
 * 让点赞数、收藏数、浏览量、评论数等会随交互变化的字段有唯一数据源，
 * 避免头部统计、操作条、评论区等分散区块各自维护副本而互相不一致。
 * 之所以用 Provider 而不是让每个区块自己订阅，是因为这些字段会被多个互不相关的兄弟组件同时读取与改写
 */
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@shared";

/**
 * 文章详情页共享状态
 */
export interface PostStateValue {
  /** 当前文章；计数类字段（views / likes / favorites / commentsCount）会随客户端交互变化，是页面内该数据的唯一来源 */
  post: Post;

  /** 以不可变方式改写文章状态：传入 updater 返回新对象，返回 void。用于点赞 / 收藏 / 评论后的乐观更新回写 */
  updatePost: (updater: (post: Post) => Post) => void;
}

/** 共享上下文；初始为 null，借此让 usePostState 能区分「未包裹 Provider」这一误用 */
const PostStateContext = createContext<PostStateValue | null>(null);

/**
 * PostStateProvider 文章状态提供者
 * @description 挂载后先乐观地把浏览量加一（与服务端上报后的值保持一致），再通过 Context 下发文章与更新方法；
 * 值对象经 useMemo 缓存，只有 post 真正变化时消费组件才会重渲染
 * @param props 组件入参
 * @param props.initialPost 服务端读取到的文章数据，作为客户端状态初始值，避免首屏重复请求；{@link Post}
 * @param props.children 需要共享文章状态的子树，通常覆盖整篇详情页
 * @returns 包裹后的子树
 */
export function PostStateProvider({
  initialPost,
  children,
}: {
  /** 服务端已读到的文章数据，作为客户端状态初始值 */
  initialPost: Post;

  /** 需要共享文章状态的子树 */
  children: React.ReactNode;
}) {
  /** 文章状态；初始值来自 SSR，后续由浏览量自增与点赞/收藏/评论的乐观更新改写 */
  const [post, setPost] = useState<Post>(initialPost);

  /** 本次挂载是否已自增过浏览量：用 ref 而非 state 既能避免多余渲染，也能抵御 React 严格模式下 effect 重复执行导致的重复计数 */
  const viewIncremented = useRef(false);

  /**
   * 挂载后乐观自增一次本地浏览量
   * @description 依赖数组为空，只执行一次；这里只改本地展示值，
   * 真正的落库由 ViewReporter 调用上报接口完成，两者配合让首屏数字立即对得上
   */
  useEffect(() => {
    if (viewIncremented.current) return;
    viewIncremented.current = true;
    setPost((prev) => ({ ...prev, views: prev.views + 1 }));
  }, []);

  /** Context 值；必须 memo：不缓存则每次渲染都会生成新对象，令所有消费组件无差别重渲染，失去 Context 按需更新的意义 */
  const value = useMemo(() => ({ post, updatePost: setPost }), [post]);

  // 把文章状态下发到子树，供头部统计、点赞收藏、评论区等客户端区块读取
  return <PostStateContext.Provider value={value}>{children}</PostStateContext.Provider>;
}

/**
 * 读取文章共享状态
 * @returns 当前文章与更新方法 {@link PostStateValue}
 * @throws 在 PostStateProvider 之外调用时抛出 Error，提示使用位置错误
 */
export function usePostState(): PostStateValue {
  const ctx = useContext(PostStateContext);
  if (!ctx) throw new Error("usePostState 必须在 PostStateProvider 内使用");
  return ctx;
}
