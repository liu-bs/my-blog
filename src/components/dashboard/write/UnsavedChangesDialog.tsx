/**
 * @file UnsavedChangesDialog.tsx
 * @description 写作页「存在未保存改动时离开确认」弹窗：单一 open 受控，仅提供「继续编辑」与「放弃改动」两条出口，
 *              自身不执行任何导航或状态清理，丢弃动作由父级在 onDiscard 中完成
 */
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * UnsavedChangesDialog 未保存改动离开确认弹窗
 * @description 使用受控 Modal 承载；三条关闭路径语义各不相同：
 *              1）蒙层点击 / ESC 关闭（Modal 的 onClose）——等同「再想想」，回退为继续编辑；
 *              2）ghost 按钮「继续编辑」——显式留在当前页，关闭弹窗；
 *              3）danger 按钮「放弃改动」——由父级接管，真正丢弃草稿并离开页面。
 *              弹窗本身只负责把这三个意图翻译成回调，不判断路由也不清理草稿
 * @param props 组件入参，字段含义见下方内联类型注释
 * @param props.open 弹窗是否可见，由父级受控
 * @param props.onOpenChange 可见性变更回调，三条关闭路径中有两条会以 false 触发它
 * @param props.onDiscard 用户确认放弃未保存改动时的回调
 * @returns 危险操作语义的确认弹窗
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  /** 弹窗可见性 */
  open: boolean;
  /** 可见性变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 放弃改动的确认回调 */
  onDiscard: () => void;
}) {
  const t = useTranslations("write");

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={t("leaveConfirmTitle")}>
      {/* 风险说明：让用户明确知道继续操作会丢失本次编辑 */}
      <p className="text-(length:--type-sm) leading-normal text-body">{t("leaveConfirmDesc")}</p>
      {/* 按钮区：默认落在「继续编辑」（非破坏性）上，破坏性操作需用户主动选择 */}
      <div className="mt-8 flex justify-end gap-2">
        {/* 安全出口：留在当前页继续编辑 */}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t("keepEditing")}
        </Button>
        {/* 破坏性出口：交由父级丢弃草稿 */}
        <Button variant="danger" onClick={onDiscard}>
          {t("discardChanges")}
        </Button>
      </div>
    </Modal>
  );
}
