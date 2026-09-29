/**
 * @file BackLink.tsx
 * @description 文章详情页的返回入口；有站内浏览历史时执行浏览器后退，否则跳回文章列表
 */
"use client";

import { useRouter } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { hasInAppHistory } from "@/lib/url";

/**
 * BackLink 返回按钮
 * @description 使用 i18n 感知的 router（@/i18n/navigation），push 时会自动带上当前语言前缀，避免回退到无前缀路径。
 *              优先走 history.back 保留来源页滚动与筛选状态；若不存在站内历史（例如从外部直接打开详情页），
 *              则退化为跳转文章列表，保证按钮始终有合理去处。
 * @returns 带左箭头的返回按钮
 */
export function BackLink() {
  /** 带语言前缀的导航实例 */
  const router = useRouter();

  /** common 命名空间文案，用于「返回」按钮文本 */
  const t = useTranslations("common");

  /** 返回动作：有站内历史则后退，否则回退到文章列表 */
  const handleBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/posts");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="mb-8 inline-flex cursor-pointer items-center gap-2 text-(length:--type-xs) font-medium text-muted transition-colors duration-[var(--duration-fast)] hover:text-heading"
    >
      {/* 左箭头图标仅作装饰，对辅助技术隐藏 */}
      <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
      {t("back")}
    </button>
  );
}
