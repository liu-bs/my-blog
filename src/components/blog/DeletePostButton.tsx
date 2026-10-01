/**
 * @file DeletePostButton.tsx
 * @description 文章删除操作组件：full 变体含编辑+删除按钮行，compact 仅删除按钮；点击弹确认 Modal，
 *              确认后调用删除接口，成功后触发 onRemoved 回调或跳转 redirectTo
 */
"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Trash2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDeletePost } from "@/hooks/usePosts";
import { postEditPath } from "@shared";
import type { PostIdProps } from "@shared";

/**
 * DeletePostButton 组件入参
 */
interface DeletePostButtonProps extends PostIdProps {
  /** 确认弹窗中的说明文案，缺省用 i18n 默认文案 */
  description?: string;

  /** 删除成功后的跳转地址，缺省仅关闭弹窗 */
  redirectTo?: string;

  /** 展示变体：full 含编辑+删除按钮行，compact 仅删除按钮 */
  variant?: "full" | "compact";

  /** 删除成功回调（列表页用于本地移除条目） */
  onRemoved?: () => void;
}

/**
 * DeletePostButton 文章删除操作
 * @param postId 文章ID
 */
export function DeletePostButton({
  postId,
  description,
  redirectTo,
  variant = "full",
  onRemoved,
}: DeletePostButtonProps) {
  const router = useRouter();

  const t = useTranslations("post");

  const tCommon = useTranslations("common");

  /** 删除确认弹窗展示状态 */
  const [showDelete, setShowDelete] = useState(false);

  /** 删除文章 mutation */
  const deleteMutation = useDeletePost();

  /**
   * 确认删除：调用删除接口，成功后优先回调 onRemoved（列表原地移除），
   * 配置了 redirectTo 时整页替换跳转
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
      {variant === "full" ? (
        <div className="mt-4 row-sm justify-end border-t border-stroke pt-4">
          <Button variant="outline" size="sm" href={postEditPath(postId)}>
            <Pencil size={14} strokeWidth={2.5} />
            {t("editPost")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-state-error"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={14} strokeWidth={2.5} />
            {t("deletePost")}
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
          {tCommon("delete")}
        </Button>
      )}

      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title={tCommon("confirmDelete")}
      >
        <p className="text-(length:--type-sm) leading-normal text-muted">
          {description ?? t("deletePostDesc")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDelete(false)}>
            {tCommon("cancel")}
          </Button>

          <Button variant="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>
            <Trash2 size={16} strokeWidth={2.5} />
            {tCommon("delete")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
