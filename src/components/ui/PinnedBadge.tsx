/**
 * @file PinnedBadge.tsx
 * @description 文章置顶标识，用于列表/详情页标注 pinned 状态
 */
import { Pin } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * PinnedBadge 置顶角标
 * @returns 带图钉图标与「置顶」文案的静态标签，无入参、无副作用
 */
export function PinnedBadge() {
  const t = useTranslations("common");
  return (
    <span className="chip-sm">
      {/* 图标尺寸偏小以匹配角标高度，语义由紧随其后的文案表达 */}
      <Pin size={10} strokeWidth={2.5} />
      {t("pinned")}
    </span>
  );
}
