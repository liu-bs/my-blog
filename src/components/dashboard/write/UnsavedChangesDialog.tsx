"use client";

import write from "@/texts/write";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;

  onOpenChange: (open: boolean) => void;

  onDiscard: () => void;
}) {
  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={write.leaveConfirmTitle}>
      <p className="text-(length:--type-sm) leading-normal text-body">{write.leaveConfirmDesc}</p>

      <div className="mt-8 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {write.keepEditing}
        </Button>

        <Button variant="danger" onClick={onDiscard}>
          {write.discardChanges}
        </Button>
      </div>
    </Modal>
  );
}
