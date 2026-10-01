/**
 * @file PostsSearchInput.tsx
 * @description 文章列表搜索框：输入经 300ms 防抖后写入 URL 查询参数 q（replace + refresh 触发服务端重查），
 *              同时重置分页 page；受控值由 URL 派生，本地 draft 仅在输入过程中覆盖展示
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PostsSearchInputProps } from "@shared";

/** 输入防抖时长，单位ms */
const DEBOUNCE_MS = 300;

/**
 * PostsSearchInput 搜索框
 * @param initialValue URL 中当前的 q 值（服务端渲染传入）
 */
export function PostsSearchInput({ initialValue }: PostsSearchInputProps) {
  const t = useTranslations("posts");

  const router = useRouter();

  /** 当前 URL 查询参数，作为搜索跳转时保留其他筛选的基础 */
  const searchParams = useSearchParams();

  /** 本地输入草稿；null 表示无未同步输入，展示回传的 initialValue */
  const [draft, setDraft] = useState<string | null>(null);

  /** 输入框展示值：优先本地草稿，否则回落到 URL 派生值 */
  const value = draft ?? initialValue;

  /** 防抖定时器引用，用于清理 */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /** 最新 searchParams 引用（供防抖回调读取，避免将其加入依赖导致重复调度） */
  const searchParamsRef = useRef(searchParams);

  // URL 已与本地输入一致（服务端确认生效）时清除草稿，恢复由 URL 驱动
  if (draft !== null && initialValue.trim() === draft.trim()) setDraft(null);

  /** 卸载时清理防抖定时器 */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** 每次渲染同步最新 searchParams 到 ref */
  useEffect(() => {
    searchParamsRef.current = searchParams;
  });

  /**
   * 防抖搜索：输入变化 300ms 后将 q 写入 URL 并清空分页 page，
   * 通过 replace + refresh 触发服务端重新查询；与当前 URL 相同则跳过
   */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (draft === null) return;

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      const urlQ = params.get("q") ?? "";
      const next = draft.trim();

      if (next === urlQ) return;
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();

      router.replace(qs ? `/posts?${qs}` : "/posts");
      router.refresh();
    }, DEBOUNCE_MS);
  }, [draft, router]);

  return (
    <div className="relative flex items-center">
      <Search
        size={16}
        strokeWidth={2.5}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
      />
      <input
        id="posts-search"
        name="q"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="input-focus h-10 w-full max-w-50 rounded-md border border-stroke-strong bg-card-bg py-0 pr-9 pl-9 text-(length:--type-xs) leading-normal text-body placeholder:text-faint"
      />

      {value && (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label={t("clearSearch")}
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors duration-[var(--duration-fast)] hover:bg-btn-hover-bg hover:text-heading"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
