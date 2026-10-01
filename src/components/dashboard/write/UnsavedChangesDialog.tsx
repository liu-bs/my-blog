/**
 * @file UnsavedChangesDialog.tsx
 * @description 未保存改动确认弹窗：useUnsavedGuard 拦截到站内离开时弹出，
 *              "继续编辑"关闭弹窗留在页面，"放弃更改"触发 onDiscard（清草稿并离开）
 */
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * UnsavedChangesDialog 未保存确认弹窗
 * @param open 是否展示
 * @param onOpenChange 弹窗开关回调
 * @param onDiscard 确认放弃：由调用方清草稿并执行离开
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  /** 是否展示 */
  open: boolean;

  /** 弹窗开关回调 */
  onOpenChange: (open: boolean) => void;

  /** 确认放弃回调 */
  onDiscard: () => void;
}) {
  const t = useTranslations("write");

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={t("leaveConfirmTitle")}>
      <p className="text-(length:--type-sm) leading-normal text-body">{t("leaveConfirmDesc")}</p>

      <div className="mt-8 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t("keepEditing")}
        </Button>

        <Button variant="danger" onClick={onDiscard}>
          {t("discardChanges")}
        </Button>
      </div>
    </Modal>
  );
}
