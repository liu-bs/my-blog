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

interface OptimisticState {

  likes: number;

  favorites: number;

  liked: boolean;

  favorited: boolean;
}

export function PostActions({ user: ssrUser }: PostActionsProps) {

  const t = useTranslations("post");

  const likeMutation = useToggleLike();

  const favoriteMutation = useToggleFavorite();

  const { post } = usePostState();

  const { user, updatePost, requireAuth } = usePostPageAuth(post.id, ssrUser);

  const [myState, setMyState] = useState<PostUserStateData | null>(null);

  const userId = user?.id;

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

  const guestCls = !user ? "opacity-60" : "";

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

      <span className="inline-flex items-center gap-1.5 text-(length:--type-xs) text-muted">
        <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
        {t("commentsCount", { count: post.commentsCount })}
      </span>
    </div>
  );
}
