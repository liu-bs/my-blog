"use client";

import { useEffect, useState, useOptimistic, useTransition } from "react";
import { Heart, Bookmark, MessageCircle } from "lucide-react";
import postDetail from "@/texts/post-detail";
import { formatTemplate } from "@/texts/format";
import { useToggleLike, useToggleFavorite } from "@/hooks/usePosts";
import { getUserPostStateAction } from "@server/post/post.controller";
import { usePostPageAuth } from "@/hooks/usePostPageAuth";
import { usePostState } from "./PostStateProvider";
import { formatCount } from "@shared/format";
import { Button } from "@/components/ui/Button";
import type { PostActionsProps, UserPostState } from "@shared";

interface OptimisticState {
  likes: number;

  favorites: number;

  liked: boolean;

  favorited: boolean;
}

export function PostActions({ user: ssrUser }: PostActionsProps) {
  const likeMutation = useToggleLike();

  const favoriteMutation = useToggleFavorite();

  const { post } = usePostState();

  const { user, updatePost, requireAuth } = usePostPageAuth(post.id, ssrUser);

  const [myState, setMyState] = useState<UserPostState | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setMyState(null);
      return;
    }
    let alive = true;
    getUserPostStateAction(post.id)
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

  const guestCls = !user ? "opacity-60" : "";

  const stateLoading = !!user && myState === null;

  const [optimisticState, addOptimistic] = useOptimistic<OptimisticState, Partial<OptimisticState>>(
    { likes: post.likes, favorites: post.favorites ?? 0, liked, favorited },
    (current, update) => ({
      ...current,
      ...update,
    }),
  );

  const [isLikePending, startLikeTransition] = useTransition();

  const [isFavPending, startFavTransition] = useTransition();

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
        isLoading={isLikePending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.liked}
        title={!user ? postDetail.loginToLike : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{postDetail.loginToLike}</span>}
        <Heart
          size={16}
          strokeWidth={2.5}
          className={optimisticState.liked ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.liked ? postDetail.liked : postDetail.like} ·{" "}
        {formatCount(optimisticState.likes)}
      </Button>

      <Button
        variant={optimisticState.favorited ? "primary" : "outline"}
        size="md"
        onClick={toggleFavorite}
        isLoading={isFavPending}
        disabled={isLikePending || isFavPending || stateLoading}
        aria-pressed={optimisticState.favorited}
        title={!user ? postDetail.loginToFavorite : undefined}
        className={`rounded-full ${guestCls}`}
      >
        {!user && <span className="sr-only">{postDetail.loginToFavorite}</span>}
        <Bookmark
          size={16}
          strokeWidth={2.5}
          className={optimisticState.favorited ? "fill-current" : ""}
          aria-hidden="true"
        />
        {optimisticState.favorited ? postDetail.favorited : postDetail.favorite} ·{" "}
        {formatCount(optimisticState.favorites)}
      </Button>

      <span className="inline-flex items-center gap-1.5 text-(length:--type-xs) text-muted">
        <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
        {formatTemplate(postDetail.commentsCount, { count: post.commentsCount })}
      </span>
    </div>
  );
}
