import { Pin } from "lucide-react";
import common from "@/texts/common";

export function PinnedBadge() {
  return (
    <span className="chip-sm">
      <Pin size={10} strokeWidth={2.5} />
      {common.pinned}
    </span>
  );
}
