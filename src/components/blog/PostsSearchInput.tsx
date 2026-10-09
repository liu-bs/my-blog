/**
 * @file PostsSearchInput.tsx
 * @description 文章列表搜索框（受控防抖输入）：输入 300ms 无变化后写入 URL 的 q 参数并
 * router.replace + refresh 触发服务端重新查询；切换筛选时由外层重置 page。
 * 通过 draft/initialValue 双轨同步：URL 回填值与草稿一致时清空草稿，避免受控值脱钩。
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { messages } from "@/texts";
import type { PostsSearchInputProps } from "@shared";

/** 输入防抖时间，单位ms */
const DEBOUNCE_MS = 300;

/**
 * 文章列表搜索输入框
 * @param initialValue 当前 URL 中已生效的搜索词（服务端回填）
 */
export function PostsSearchInput({ initialValue }: PostsSearchInputProps) {
  const router = useRouter();

  const searchParams = useSearchParams();

  /** 本地草稿搜索词，null 表示无编辑中的草稿、直接展示 URL 回填值 */
  const [draft, setDraft] = useState<string | null>(null);

  const value = draft ?? initialValue;

  /** 防抖计时器Ref */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /** 最新 searchParams 镜像Ref，防抖回调中读取避免闭包过期 */
  const searchParamsRef = useRef(searchParams);

  // URL 回填值与草稿（忽略首尾空格）一致时清掉草稿，让输入框回到受控于 URL 的状态
  if (draft !== null && initialValue.trim() === draft.trim()) setDraft(null);

  /** 卸载时清理未触发的防抖计时器 */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** 每次渲染刷新 searchParams 镜像 */
  useEffect(() => {
    searchParamsRef.current = searchParams;
  });

  /**
   * 草稿变化后启动防抖：到期时把 trim 后的搜索词写入/删除 q 参数、删除 page 参数，
   * replace 到 /posts 并 refresh 触发服务端搜索；与 URL 现值相同则跳过。
   * @warning 依赖里不含 searchParams，读取的是镜像Ref，勿在回调里改用闭包值。
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
      {/* 放大镜图标，纯装饰 */}
      <Search
        size={16}
        strokeWidth={2.5}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
      />
      {/* 搜索输入框 */}
      <input
        id="posts-search"
        name="q"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={messages.posts.searchPlaceholder}
        aria-label={messages.posts.searchPlaceholder}
        className="input-focus h-10 w-full max-w-50 rounded-md border border-stroke-strong bg-card-bg py-0 pr-9 pl-9 text-(length:--type-xs) leading-normal text-body placeholder:text-faint"
      />

      {/* 清除按钮：有值时显示，点击置空草稿并触发防抖搜索 */}
      {value && (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label={messages.posts.clearSearch}
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors duration-[var(--duration-fast)] hover:bg-btn-hover-bg hover:text-heading"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
