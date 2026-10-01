/**
 * @file PinnedBadge.tsx
 * @description 文章置顶标记徽章：图钉图标 + next-intl 国际化「置顶」文案
 */
import { Pin } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * PinnedBadge 置顶徽章
 * @description 文案取自 common 命名空间的 pinned 键
 */
export function PinnedBadge() {
  const t = useTranslations("common");
  return (
    <span className="chip-sm">
      <Pin size={10} strokeWidth={2.5} />
      {t("pinned")}
    </span>
  );
}
