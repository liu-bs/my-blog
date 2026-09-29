/**
 * @file PostActions.tsx
 * @description 文章详情页的互动操作区：点赞、收藏与评论数展示；未登录时引导登录，点赞 / 收藏均做乐观更新
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
 * 点赞 / 收藏的乐观状态
 * @description 由全局 post 统计值与「当前用户是否已点赞 / 收藏」拼成，用于点击瞬间先更新 UI
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
 * PostActions 文章互动操作区
 * @description 点赞 / 收藏按钮未登录时依然可点击，点击后由 requireAuth 跳转登录并带回跳地址；
 *              登录态下点击先做乐观更新（计数与选中态立即变化），请求成功再写回本地状态与全局 post 统计，
 *              失败时不写回，乐观值随 transition 结束自动回滚。
 * @param props {@link PostActionsProps}，user 为 SSR 下发的登录用户，用于客户端登录态就绪前判断
 * @returns 点赞、收藏按钮与评论数展示
 */
export function PostActions({ user: ssrUser }: PostActionsProps) {
  /** post 命名空间文案，用于点赞 / 收藏 / 评论相关文本 */
  const t = useTranslations("post");

  /** 点赞切换 mutation */
  const likeMutation = useToggleLike();

  /** 收藏切换 mutation */
  const favoriteMutation = useToggleFavorite();

  /** 当前文章数据与更新方法（来自详情页 PostStateProvider） */
  const { post } = usePostState();

  /** 详情页登录态与文章更新能力，requireAuth 负责未登录时跳登录 */
  const { user, updatePost, requireAuth } = usePostPageAuth(post.id, ssrUser);

  /** 当前用户对本文的互动状态，未登录或尚未拉取到时为 null */
  const [myState, setMyState] = useState<PostUserStateData | null>(null);

  /** 当前用户 ID，作为拉取互动状态的依赖 */
  const userId = user?.id;

  /**
   * 拉取当前用户对本文的点赞 / 收藏状态
   * @description 依赖登录用户与文章 ID：未登录时清空状态；登录后请求服务端并写回。
   *              用 alive 标记避免组件卸载或依赖变化后仍对已失效的请求写入 state。
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

  /** 是否已点赞，状态未拉取到时按未点赞处理 */
  const liked = myState?.liked ?? false;

  /** 是否已收藏，状态未拉取到时按未收藏处理 */
  const favorited = myState?.favorited ?? false;

  /** 未登录时的按钮降透明度类，弱化但不禁用，以便点击后引导登录 */
  const guestCls = !user ? "opacity-60" : "";

  /**
   * 乐观状态：基准值取全局 post 的点赞 / 收藏数与本地互动状态
   * @description 更新函数做浅合并；transition 结束后会回落到此处的最新基准值，
   *              因此成功时必须同步更新基准来源（myState / post），否则会出现「闪回」。
   */
  const [optimisticState, addOptimistic] = useOptimistic<OptimisticState, Partial<OptimisticState>>(
    { likes: post.likes, favorites: post.favorites ?? 0, liked, favorited },
    (current, update) => ({
      ...current,
      ...update,
    }),
  );

  /** 点赞请求的过渡状态，用作按钮 loading */
  const [isLikePending, startLikeTransition] = useTransition();

  /** 收藏请求的过渡状态，用作按钮 loading */
  const [isFavPending, startFavTransition] = useTransition();

  /** 切换点赞：未登录先跳登录，登录后乐观翻转再请求，成功写回状态与总数 */
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

  /** 切换收藏：逻辑与点赞一致，成功后同步收藏总数 */
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
      {/* 点赞按钮：已赞时用主色填充，未登录时 title 提示登录，并为读屏提供隐藏文案 */}
      <Button
        variant={optimisticState.liked ? "primary" : "outline"}
        size="md"
        onClick={toggleLike}
        loading={isLikePending}
        disabled={isLikePending || isFavPending}
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

      {/* 收藏按钮：形态与点赞一致，已收藏时主色填充 */}
      <Button
        variant={optimisticState.favorited ? "primary" : "outline"}
        size="md"
        onClick={toggleFavorite}
        loading={isFavPending}
        disabled={isLikePending || isFavPending}
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

      {/* 评论数展示：只读，数值来自全局 post，评论增删后会同步更新 */}
      <span className="inline-flex items-center gap-1.5 text-(length:--type-xs) text-muted">
        <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
        {t("commentsCount", { count: post.commentsCount })}
      </span>
    </div>
  );
}
