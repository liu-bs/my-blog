/**
 * @file RemoveFavoriteButton.tsx
 * @description 取消收藏按钮：调用收藏切换 mutation 移除当前文章收藏，成功后回调通知父级从列表剔除
 * @usage 客户端组件，用于个人主页「收藏」标签页文章卡操作区；依赖登录态与 postId
 */
"use client";

import { BookmarkX } from "lucide-react";
import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToggleFavorite } from "@/hooks/usePosts";
import type { PostIdProps } from "@shared";

/** RemoveFavoriteButton 组件入参 */
interface RemoveFavoriteButtonProps extends PostIdProps {
  /** 取消收藏成功后的回调，用于父组件本地移除该条目 */
  onRemoved?: () => void;
}

/**
 * 取消收藏按钮
 * @param props.postId 目标文章 ID
 * @param props.onRemoved 取消成功回调
 * @returns 带加载态的收藏移除按钮
 */
export function RemoveFavoriteButton({ postId, onRemoved }: RemoveFavoriteButtonProps) {
  /** 收藏切换 mutation，提供 isPending 加载态与 mutate 触发方法 */
  const toggleFavoriteMutation = useToggleFavorite();

  // 取消收藏按钮：请求进行中禁用并显示 spinner，否则显示取消收藏图标
  return (
    <Button
      variant="ghost"
      size="sm"

      disabled={toggleFavoriteMutation.isPending}
      onClick={() =>
        toggleFavoriteMutation.mutate(postId, {
          onSuccess: (data) => {
            // 仅当后端确认已取消收藏（favorited=false）时才通知父级移除
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
      {messages.profile.removeFavorite}
    </Button>
  );
}
