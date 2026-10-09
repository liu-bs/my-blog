/**
 * @file UnsavedChangesDialog.tsx
 * @description 未保存更改确认弹窗：写作页离开时提示用户继续编辑或放弃草稿
 * @usage 客户端组件，受控弹窗；由 useUnsavedGuard 驱动 open 状态，onDiscard 负责清理草稿并跳转
 */
"use client";

import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * 未保存更改确认弹窗
 * @param props.open 是否显示弹窗
 * @param props.onOpenChange 弹窗开关回调（关闭时传 false）
 * @param props.onDiscard 点击「放弃更改」的回调
 * @returns 含说明文案与两个操作按钮的模态框
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  /** 是否显示弹窗 */
  open: boolean;

  /** 弹窗开关回调 */
  onOpenChange: (open: boolean) => void;

  /** 放弃更改回调 */
  onDiscard: () => void;
}) {
  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={messages.write.leaveConfirmTitle}>
      {/* 说明正文 */}
      <p className="text-(length:--type-sm) leading-normal text-body">
        {messages.write.leaveConfirmDesc}
      </p>

      {/* 底部操作区：继续编辑（关闭弹窗）/ 放弃更改 */}
      <div className="mt-8 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {messages.write.keepEditing}
        </Button>

        <Button variant="danger" onClick={onDiscard}>
          {messages.write.discardChanges}
        </Button>
      </div>
    </Modal>
  );
}
