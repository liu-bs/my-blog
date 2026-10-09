/**
 * @file PinnedBadge.tsx
 * @description 置顶标记徽章，展示图钉图标与"置顶"文案；用于文章列表中已置顶文章的标识
 */
import { Pin } from "lucide-react";
import { messages } from "@/texts";

/** 置顶徽章（无入参，文案取自 messages.common.pinned） */
export function PinnedBadge() {
  return (
    <span className="chip-sm">
      {/* 图钉装饰图标 */}
      <Pin size={10} strokeWidth={2.5} />
      {messages.common.pinned}
    </span>
  );
}
