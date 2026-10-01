/**
 * @file BackLink.tsx
 * @description 返回按钮：应用内有历史时 router.back() 返回上一页，
 *              直接打开详情页（无站内历史）时兜底跳转文章列表 /posts
 */
"use client";

import { useRouter } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { hasInAppHistory } from "@/lib/url";

/**
 * BackLink 返回按钮
 */
export function BackLink() {
  const router = useRouter();

  const t = useTranslations("common");

  /** 有站内历史则回退，否则兜底到文章列表页 */
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
      <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
      {t("back")}
    </button>
  );
}
