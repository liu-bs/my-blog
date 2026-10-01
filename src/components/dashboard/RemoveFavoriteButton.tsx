/**
 * @file RemoveFavoriteButton.tsx
 * @description 收藏列表中的"取消收藏"按钮：调用 toggleFavorite 接口，
 *              仅当服务端确认 favorited === false 时回调 onRemoved 移除列表项，防止状态错删
 */
"use client";

import { BookmarkX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToggleFavorite } from "@/hooks/usePosts";
import type { PostIdProps } from "@shared";

/**
 * RemoveFavoriteButton 组件入参
 */
interface RemoveFavoriteButtonProps extends PostIdProps {
  /** 取消收藏成功后的回调（列表页移除对应条目） */
  onRemoved?: () => void;
}

/**
 * RemoveFavoriteButton 取消收藏按钮
 * @param postId 文章ID
 */
export function RemoveFavoriteButton({ postId, onRemoved }: RemoveFavoriteButtonProps) {
  const t = useTranslations("profile");

  /** 收藏 toggle mutation（同一接口切换收藏/取消收藏） */
  const toggleFavoriteMutation = useToggleFavorite();

  return (
    <Button
      variant="ghost"
      size="sm"

      disabled={toggleFavoriteMutation.isPending}
      onClick={() =>
        toggleFavoriteMutation.mutate(postId, {
          /* 服务端确认已变为未收藏时才移除列表项，避免异常返回误删 */
          onSuccess: (data) => {
            if (data.favorited === false) onRemoved?.();
          },
        })
      }
    >
      {toggleFavoriteMutation.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <BookmarkX data-icon="inline-start" size={14} strokeWidth={2.5} />
      )}
      {t("removeFavorite")}
    </Button>
  );
}
