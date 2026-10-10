import { Pin } from "lucide-react";
import { messages } from "@/texts";

export function PinnedBadge() {
  return (
    <span className="chip-sm">

      <Pin size={10} strokeWidth={2.5} />
      {messages.common.pinned}
    </span>
  );
}
