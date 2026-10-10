"use client";

import { texts } from "@/texts";
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
    <Modal open={open} onClose={() => onOpenChange(false)} title={texts.write.leaveConfirmTitle}>
      <p className="text-(length:--type-sm) leading-normal text-body">
        {texts.write.leaveConfirmDesc}
      </p>

      <div className="mt-8 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {texts.write.keepEditing}
        </Button>

        <Button variant="danger" onClick={onDiscard}>
          {texts.write.discardChanges}
        </Button>
      </div>
    </Modal>
  );
}
