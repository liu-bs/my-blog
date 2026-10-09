/**
 * @file DeletePostButton.tsx
 * @description 删除文章按钮组件：点击弹出确认 Modal，确认后调用 useDeletePost 删除文章，
 * 成功回调 onRemoved 并按需跳转到 redirectTo。支持 full（编辑+删除成组按钮）与 compact（仅删除）两种形态。
 * 由 AuthorActions 及文章列表/管理入口复用。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";
import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDeletePost } from "@/hooks/usePosts";
import { postEditPath } from "@shared";
import type { PostIdProps } from "@shared";

/**
 * DeletePostButton 组件入参，继承 postId 字段
 */
interface DeletePostButtonProps extends PostIdProps {
  /** 确认弹窗描述文案，缺省用默认删除提示 */
  description?: string;

  /** 删除成功后跳转的路径，缺省不跳转仅关闭弹窗 */
  redirectTo?: string;

  /** 按钮形态：full 为"编辑+删除"成组，compact 为单个删除按钮 */
  variant?: "full" | "compact";

  /** 删除成功后的回调（如从列表中移除该卡片） */
  onRemoved?: () => void;
}

/**
 * 删除文章按钮（含确认弹窗）
 * @param props {@link DeletePostButtonProps}
 */
export function DeletePostButton({
  postId,
  description,
  redirectTo,
  variant = "full",
  onRemoved,
}: DeletePostButtonProps) {
  const router = useRouter();

  /** 删除确认弹窗是否打开 */
  const [showDelete, setShowDelete] = useState(false);

  /** 删除文章 mutation */
  const deleteMutation = useDeletePost();

  /**
   * 确认删除：调用删除接口，成功后触发回调并跳转或关闭弹窗
   */
  const confirmDelete = () => {
    deleteMutation.mutate(postId, {
      onSuccess: () => {
        onRemoved?.();
        if (redirectTo) router.replace(redirectTo);
        else setShowDelete(false);
      },
    });
  };

  return (
    <>
      {/* 按钮区：full 形态展示"编辑+删除"成组，compact 形态仅单个删除按钮 */}
      {variant === "full" ? (
        <div className="mt-4 row-sm justify-end border-t border-stroke pt-4">
          <Button variant="outline" size="sm" href={postEditPath(postId)}>
            <Pencil size={14} strokeWidth={2.5} />
            {messages.post.editPost}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-state-error"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={14} strokeWidth={2.5} />
            {messages.post.deletePost}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-state-error"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 size={14} strokeWidth={2.5} />
          {messages.common.delete}
        </Button>
      )}

      {/* 删除确认弹窗 */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title={messages.common.confirmDelete}
      >
        {/* 弹窗描述文案，支持调用方覆盖 */}
        <p className="text-(length:--type-sm) leading-normal text-muted">
          {description ?? messages.post.deletePostDesc}
        </p>
        {/* 弹窗操作区：取消 / 确认删除（删除中展示 loading） */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDelete(false)}>
            {messages.common.cancel}
          </Button>

          <Button variant="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>
            <Trash2 size={16} strokeWidth={2.5} />
            {messages.common.delete}
          </Button>
        </div>
      </Modal>
    </>
  );
}
