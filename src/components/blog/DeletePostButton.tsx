/**
 * @file DeletePostButton.tsx
 * @description 文章删除按钮，内置二次确认弹窗；删除成功后按需跳转或仅关闭弹窗，供作者操作区与卡片操作区共用
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
 * @description 在 {@link PostIdProps} 基础上扩展确认文案、删除后去向、形态与删除回调
 */
interface DeletePostButtonProps extends PostIdProps {
  /** 自定义二次确认弹窗的说明文案；缺省时使用 i18n 的 deletePostDesc */
  description?: string;

  /** 删除成功后的跳转地址；为空时只关闭弹窗不跳转（如列表内删除） */
  redirectTo?: string;

  /** 展示形态：full 会额外渲染「编辑」按钮并带底部分隔线，compact 只渲染删除按钮 */
  variant?: "full" | "compact";

  /** 删除成功后的额外回调，例如在列表页移除本地对应条目 */
  onRemoved?: () => void;
}

/**
 * DeletePostButton 删除文章按钮
 * @description 点击先弹出确认框，确认后才真正发起删除；删除进行中按钮处于 loading 并禁用重复点击。
 *              删除成功后：有 redirectTo 则 replace 到目标页（避免回退到已删除的详情页），否则仅关闭弹窗。
 * @param props {@link DeletePostButtonProps}
 * @returns 触发按钮 + 二次确认弹窗
 */
export function DeletePostButton({
  postId,
  description,
  redirectTo,
  variant = "full",
  onRemoved,
}: DeletePostButtonProps) {
  /** 带语言前缀的导航实例，跳转会保留当前语言 */
  const router = useRouter();

  /** post 命名空间文案，用于编辑 / 删除文章相关文本 */
  const t = useTranslations("post");

  /** common 命名空间文案，用于「删除 / 取消 / 确认删除」等通用文案 */
  const tCommon = useTranslations("common");

  /** 是否展示删除确认弹窗 */
  const [showDelete, setShowDelete] = useState(false);

  /** 删除请求：isPending 用于按钮 loading，失败提示由该 mutation 的默认 onError 处理 */
  const deleteMutation = useDeletePost();

  /** 确认删除：成功后先回调 onRemoved，再按 redirectTo 决定跳转或仅收起弹窗 */
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
        /* full 形态：底部右下角并列「编辑」与「删除」，用于文章详情页 */
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
        /* compact 形态：仅一个删除按钮，用于卡片等紧凑区域 */
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

      {/* 二次确认弹窗：说明文案优先取 description，否则回退到 i18n 默认描述 */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title={tCommon("confirmDelete")}
      >
        <p className="text-(length:--type-sm) leading-normal text-muted">
          {description ?? t("deletePostDesc")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          {/* 取消：仅关闭弹窗，不发起请求 */}
          <Button variant="ghost" onClick={() => setShowDelete(false)}>
            {tCommon("cancel")}
          </Button>
          {/* 确认删除：loading 期间按钮禁用，防止重复提交 */}
          <Button variant="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>
            <Trash2 size={16} strokeWidth={2.5} />
            {tCommon("delete")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
