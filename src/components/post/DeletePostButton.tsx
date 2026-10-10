"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";
import common from "@/texts/common";
import postDetail from "@/texts/post-detail";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDeletePost } from "@/hooks/usePosts";
import { postEditPath } from "@shared";
import type { PostIdProps } from "@shared";

interface DeletePostButtonProps extends PostIdProps {
  description?: string;

  redirectTo?: string;

  variant?: "full" | "compact";

  onRemoved?: () => void;
}

export function DeletePostButton({
  postId,
  description,
  redirectTo,
  variant = "full",
  onRemoved,
}: DeletePostButtonProps) {
  const router = useRouter();

  const [showDelete, setShowDelete] = useState(false);

  const deleteMutation = useDeletePost();

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
            {postDetail.editPost}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-state-error"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={14} strokeWidth={2.5} />
            {postDetail.deletePost}
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
          {common.delete}
        </Button>
      )}

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title={common.confirmDelete}>
        <p className="text-(length:--type-sm) leading-normal text-muted">
          {description ?? postDetail.deletePostDesc}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDelete(false)}>
            {common.cancel}
          </Button>

          <Button variant="danger" onClick={confirmDelete} isLoading={deleteMutation.isPending}>
            <Trash2 size={16} strokeWidth={2.5} />
            {common.delete}
          </Button>
        </div>
      </Modal>
    </>
  );
}
