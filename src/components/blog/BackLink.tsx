/**
 * @file BackLink.tsx
 * @description 返回按钮组件：优先浏览器历史回退（router.back），无站内历史时兜底跳转文章列表页 /posts。
 * 用于文章详情页、编辑页等二级页面顶部。
 */
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { messages } from "@/texts";
import { hasInAppHistory } from "@/lib/url";

/**
 * 返回上一页按钮
 */
export function BackLink() {
  const router = useRouter();

  /**
   * 点击返回：有站内历史记录则回退，否则跳转到文章列表页
   */
  const handleBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/posts");
    }
  };

  return (
    // 返回按钮：左箭头图标 + 文案
    <button
      onClick={handleBack}
      className="mb-8 inline-flex cursor-pointer items-center gap-2 text-(length:--type-xs) font-medium text-muted transition-colors duration-[var(--duration-fast)] hover:text-heading"
    >
      <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
      {messages.common.back}
    </button>
  );
}
