/**
 * @file RemoveFavoriteButton.tsx
 * @description 收藏列表中的「取消收藏」按钮：调用 useToggleFavorite 对应的 Server Action 取消收藏。
 * 组件自身不做数据刷新，成功与否交由父级通过 onRemoved 决定（父级用本地移除 ID 的方式即时隐藏条目）；
 * 请求进行中禁用按钮并展示 loading，失败提示由 useToggleFavorite 内部统一处理。
 */
"use client";

import { BookmarkX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToggleFavorite } from "@/hooks/usePosts";
import type { PostIdProps } from "@shared";

/**
 * RemoveFavoriteButton 入参
 */
interface RemoveFavoriteButtonProps extends PostIdProps {
  /** 取消收藏成功后的回调，通常用于从父级列表中移除该条 */
  onRemoved?: () => void;
}

/**
 * RemoveFavoriteButton 取消收藏按钮
 * @param props {@link RemoveFavoriteButtonProps}
 * @returns 带 loading 态的取消收藏按钮
 */
export function RemoveFavoriteButton({ postId, onRemoved }: RemoveFavoriteButtonProps) {
  const t = useTranslations("profile");

  /** 收藏切换动作；此处仅使用其 pending 状态与 cancel 收藏的调用能力 */
  const toggleFavoriteMutation = useToggleFavorite();

  return (
    <Button
      variant="ghost"
      size="sm"
      // 请求进行中禁用，避免重复提交
      disabled={toggleFavoriteMutation.isPending}
      onClick={() =>
        toggleFavoriteMutation.mutate(postId, {
          // 仅在成功后通知父级移除，失败时保留原条目
          onSuccess: () => onRemoved?.(),
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
