/**
 * @file PostActions.tsx
 * @description 文章互动操作栏：点赞/收藏按钮与评论数展示；
 *              挂载后经 getMyPostStateAction 拉取当前用户的点赞/收藏个人状态，加载完成前按钮禁用防止反向 toggle；
 *              点击采用乐观更新先行，接口返回后用服务端真实计数覆盖，未登录经 requireAuth 引导登录
 */
"use client";

import { useEffect, useState, useOptimistic, useTransition } from "react";
import { Heart, Bookmark, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToggleLike, useToggleFavorite } from "@/hooks/usePosts";
import { getMyPostStateAction } from "@server/blog/blog.controller";
import { usePostPageAuth } from "@/hooks/usePostPageAuth";
import { usePostState } from "./PostStateProvider";
import { formatCount } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import type { PostActionsProps, PostUserStateData } from "@shared";

/**
 * 乐观互动状态：点赞/收藏的计数与选中标记
 */
interface OptimisticState {
  /** 点赞数 */
  likes: number;

  /** 收藏数 */
  favorites: number;

  /** 当前用户是否已点赞 */
  liked: boolean;

  /** 当前用户是否已收藏 */
  favorited: boolean;
}

/**
 * PostActions 文章互动操作栏
 * @param ssrUser 服务端注入的当前登录用户
 */
export function PostActions({ user: ssrUser }: PostActionsProps) {
  const t = useTranslations("post");

  /** 点赞 toggle mutation */
  const likeMutation = useToggleLike();

  /** 收藏 toggle mutation */
  const favoriteMutation = useToggleFavorite();

  /** 从详情页状态容器读取文章数据 */
  const { post } = usePostState();

  /** 登录用户、文章状态更新与登录守卫（未登录点击时引导登录） */
  const { user, updatePost, requireAuth } = usePostPageAuth(post.id, ssrUser);

  /** 当前用户的点赞/收藏个人状态，null 表示尚未加载完成 */
  const [myState, setMyState] = useState<PostUserStateData | null>(null);

  const userId = user?.id;

  /**
   * 登录后拉取当前用户对本文的点赞/收藏状态
   * 未登录时清空个人状态；卸载或依赖变化后丢弃过期响应（alive 标记防竞态）
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

  /** 未点赞时的展示值（个人状态未加载时兜底为 false） */
  const liked = myState?.liked ?? false;

  /** 未收藏时的展示值（个人状态未加载时兜底为 false） */
  const favorited = myState?.favorited ?? false;

  /** 未登录时按钮降透明度（仅视觉提示，点击会走登录守卫） */
  const guestCls = !user ? "opacity-60" : "";

  /** 已登录但个人状态尚未返回：按钮禁用，防止在未知初始态上反向 toggle */
  const stateLoading = !!user && myState === null;

  /**
   * 乐观互动状态：初始值取文章计数与个人状态
   * 点击时立即合并局部更新（addOptimistic），transition 结束后若未派发新值会自动回落
   */
  const [optimisticState, addOptimistic] = useOptimistic<OptimisticState, Partial<OptimisticState>>(
    { likes: post.likes, favorites: post.favorites ?? 0, liked, favorited },
    (current, update) => ({
      ...current,
      ...update,
    }),
  );

  /** 点赞请求进行中标记，用于按钮 loading 与互斥禁用 */
  const [isLikePending, startLikeTransition] = useTransition();

  /** 收藏请求进行中标记，用于按钮 loading 与互斥禁用 */
  const [isFavPending, startFavTransition] = useTransition();

  /**
   * 点赞/取消点赞：
   * 乐观翻转 liked 并同步 ±1 计数（下限 0），请求返回后用服务端真实结果覆盖
   * 个人 liked 状态与文章总点赞数，避免本地推导与真实数据产生偏差
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
   * 收藏/取消收藏：流程同点赞——乐观翻转 favorited 并同步 ±1 计数（下限 0），
   * 请求返回后用服务端真实 favorited 与 favorites 覆盖本地
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
      <Button
        variant={optimisticState.liked ? "primary" : "outline"}
        size="md"
        onClick={toggleLike}
        loading={isLikePending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.liked}
        title={!user ? t("loginToLike") : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{t("loginToLike")}</span>}
        <Heart
          size={16}
          strokeWidth={2.5}
          className={optimisticState.liked ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.liked ? t("liked") : t("like")} · {formatCount(optimisticState.likes)}
      </Button>

      <Button
        variant={optimisticState.favorited ? "primary" : "outline"}
        size="md"
        onClick={toggleFavorite}
        loading={isFavPending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.favorited}
        title={!user ? t("loginToFavorite") : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{t("loginToFavorite")}</span>}
        <Bookmark
          size={16}
          strokeWidth={2.5}
          className={optimisticState.favorited ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.favorited ? t("favorited") : t("favorite")} ·{" "}
        {formatCount(optimisticState.favorites)}
      </Button>

      <span className="inline-flex items-center gap-1.5 text-(length:--type-xs) text-muted">
        <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
        {t("commentsCount", { count: post.commentsCount })}
      </span>
    </div>
  );
}
