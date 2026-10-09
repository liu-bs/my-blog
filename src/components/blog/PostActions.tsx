/**
 * @file PostActions.tsx
 * @description 文章互动操作区（点赞/收藏/评论数展示）：登录后进入页面会经 Server Action
 * getMyPostStateAction 拉取当前用户点赞/收藏状态，点击时通过 useOptimistic + useTransition
 * 先行乐观更新计数与状态，再调用 useToggleLike/useToggleFavorite 落库；游客仅可见不可操作（半透明+提示）。
 */
"use client";

import { useEffect, useState, useOptimistic, useTransition } from "react";
import { Heart, Bookmark, MessageCircle } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { useToggleLike, useToggleFavorite } from "@/hooks/usePosts";
import { getMyPostStateAction } from "@server/blog/blog.controller";
import { usePostPageAuth } from "@/hooks/usePostPageAuth";
import { usePostState } from "./PostStateProvider";
import { formatCount } from "@shared/format";
import { Button } from "@/components/ui/Button";
import type { PostActionsProps, PostUserStateData } from "@shared";

/**
 * 乐观更新使用的互动状态快照
 */
interface OptimisticState {
  /** 点赞总数 */
  likes: number;

  /** 收藏总数 */
  favorites: number;

  /** 当前用户是否已点赞 */
  liked: boolean;

  /** 当前用户是否已收藏 */
  favorited: boolean;
}

/**
 * 文章互动操作区
 * @param ssrUser 服务端渲染透传的当前用户
 */
export function PostActions({ user: ssrUser }: PostActionsProps) {
  /** 点赞切换 mutation */
  const likeMutation = useToggleLike();

  /** 收藏切换 mutation */
  const favoriteMutation = useToggleFavorite();

  // 文章数据来自 PostStateProvider，点赞/收藏数回写也走该上下文
  const { post } = usePostState();

  const { user, updatePost, requireAuth } = usePostPageAuth(post.id, ssrUser);

  /** 当前用户对该文章的点赞/收藏状态，未加载或未登录为 null */
  const [myState, setMyState] = useState<PostUserStateData | null>(null);

  const userId = user?.id;

  /**
   * 登录用户对每篇文章只拉取一次个人互动状态；
   * alive 标记防止组件卸载/依赖切换后仍回写状态
   */
  useEffect(() => {
    if (!userId) {
      setMyState(null);
      return;
    }
    let alive = true;
    getMyPostStateAction(post.id)
      .then((result) => {
        if (alive && result.ok) setMyState(result.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, post.id]);

  const liked = myState?.liked ?? false;

  const favorited = myState?.favorited ?? false;

  /** 游客状态下按钮半透明样式 */
  const guestCls = !user ? "opacity-60" : "";

  /** 已登录但个人状态尚未拉取到时视为加载中，禁用按钮 */
  const stateLoading = !!user && myState === null;

  // 乐观状态基值取自 post 计数与 myState；切换时先合并局部更新再等待接口结果
  const [optimisticState, addOptimistic] = useOptimistic<OptimisticState, Partial<OptimisticState>>(
    { likes: post.likes, favorites: post.favorites ?? 0, liked, favorited },
    (current, update) => ({
      ...current,
      ...update,
    }),
  );

  const [isLikePending, startLikeTransition] = useTransition();

  const [isFavPending, startFavTransition] = useTransition();

  /**
   * 切换点赞：需登录。先乐观更新 liked/likes，接口成功后回写 myState
   * 并同步 provider 中的文章点赞数
   */
  const toggleLike = () => {
    requireAuth(() => {
      startLikeTransition(async () => {
        const newLiked = !optimisticState.liked;
        addOptimistic({
          liked: newLiked,
          likes: newLiked ? optimisticState.likes + 1 : Math.max(0, optimisticState.likes - 1),
        });
        const data = await likeMutation.mutate(post.id);
        if (data) {
          setMyState((prev) => ({
            liked: data.liked,
            favorited: prev?.favorited ?? favorited,
          }));
          updatePost((prev) => ({ ...prev, likes: data.likes }));
        }
      });
    });
  };

  /**
   * 切换收藏：需登录。先乐观更新 favorited/favorites，接口成功后回写 myState
   * 并同步 provider 中的文章收藏数
   */
  const toggleFavorite = () => {
    requireAuth(() => {
      startFavTransition(async () => {
        const newFavorited = !optimisticState.favorited;
        addOptimistic({
          favorited: newFavorited,
          favorites: newFavorited
            ? optimisticState.favorites + 1
            : Math.max(0, optimisticState.favorites - 1),
        });
        const data = await favoriteMutation.mutate(post.id);
        if (data) {
          setMyState((prev) => ({
            liked: prev?.liked ?? liked,
            favorited: data.favorited,
          }));
          updatePost((prev) => ({ ...prev, favorites: data.favorites }));
        }
      });
    });
  };

  return (
    <div className="mt-8 row-md flex-wrap border-t border-b border-stroke py-8">
      {/* 点赞按钮：已点赞填充红心并展示"已赞"，aria-pressed 标记按压态 */}
      <Button
        variant={optimisticState.liked ? "primary" : "outline"}
        size="md"
        onClick={toggleLike}
        loading={isLikePending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.liked}
        title={!user ? messages.post.loginToLike : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{messages.post.loginToLike}</span>}
        <Heart
          size={16}
          strokeWidth={2.5}
          className={optimisticState.liked ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.liked ? messages.post.liked : messages.post.like} ·{" "}
        {formatCount(optimisticState.likes)}
      </Button>

      {/* 收藏按钮：已收藏填充书签并展示"已藏" */}
      <Button
        variant={optimisticState.favorited ? "primary" : "outline"}
        size="md"
        onClick={toggleFavorite}
        loading={isFavPending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.favorited}
        title={!user ? messages.post.loginToFavorite : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{messages.post.loginToFavorite}</span>}
        <Bookmark
          size={16}
          strokeWidth={2.5}
          className={optimisticState.favorited ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.favorited ? messages.post.favorited : messages.post.favorite} ·{" "}
        {formatCount(optimisticState.favorites)}
      </Button>

      {/* 评论数只读展示，无交互 */}
      <span className="inline-flex items-center gap-1.5 text-(length:--type-xs) text-muted">
        <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
        {formatTemplate(messages.post.commentsCount, { count: post.commentsCount })}
      </span>
    </div>
  );
}
