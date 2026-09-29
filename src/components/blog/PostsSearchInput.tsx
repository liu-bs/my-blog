/**
 * @file PostsSearchInput.tsx
 * @description 文章列表页的搜索框：输入防抖后把关键词同步进 URL 的 q 参数，再由服务端按 URL 重新取数。
 * 输入值以本地 draft 为准，URL 仅作为「服务端真值」参与比对；没有独立的提交按钮，
 * 输入停顿即触发跳转，清空按钮则立即清掉关键词
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PostsSearchInputProps } from "@shared";

/** 输入停止后的防抖时长，单位毫秒；用于避免每敲一个字符都发起一次导航 */
const DEBOUNCE_MS = 300;

/**
 * PostsSearchInput 搜索输入框
 * @description 同步逻辑：draft 变化后等待防抖窗口结束，再基于最新 searchParams 改写 q 参数并重置分页；
 * 若服务端回传的 initialValue 已与 draft 一致，说明 URL 已跟上输入，提前释放 draft 使输入框重新受 URL 控制
 * @param props 组件入参 {@link PostsSearchInputProps}
 * @param props.initialValue 来自 URL 的搜索词，作为输入框的初始值与服务端真值
 * @returns 带搜索图标与清空按钮的输入框
 */
export function PostsSearchInput({ initialValue }: PostsSearchInputProps) {
  const t = useTranslations("posts");

  // 带语言前缀的 router，保证 replace 后的地址不丢失 locale
  const router = useRouter();

  /** 当前 URL 查询参数，用于在改写时保留分类、标签等其他筛选条件 */
  const searchParams = useSearchParams();

  /** 用户正在输入的草稿值；null 表示无草稿，此时输入框完全跟随 URL 的 initialValue */
  const [draft, setDraft] = useState<string | null>(null);

  /** 输入框真实展示值：有草稿时以草稿优先（保证打字不被服务端回包打断），否则回落到 URL 值 */
  const value = draft ?? initialValue;

  /** 防抖计时器句柄，每次输入都重置；null 表示无待执行的同步 */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /** 保存最新的 searchParams 供防抖回调读取：回调延迟执行，直接闭包会拿到过期值 */
  const searchParamsRef = useRef(searchParams);

  // 服务端真值追平草稿后释放草稿（比较时 trim，避免仅空白差异导致的反复重置）；在渲染期直接收敛状态，可少一次中间态渲染
  if (draft !== null && initialValue.trim() === draft.trim()) setDraft(null);

  /** 卸载时清理未触发的防抖计时器，避免对已卸载组件发起导航 */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** 每次渲染后同步最新的 searchParams 引用，供防抖回调使用 */
  useEffect(() => {
    searchParamsRef.current = searchParams;
  });

  /**
   * 防抖同步草稿到 URL
   * @description draft 为 null 时说明无待同步的输入，直接返回；
   * 写入前先与 URL 现值比对，相同则不发请求，避免无谓导航；
   * 关键词变化一律删除 page 参数回到第一页，否则会停在一个已不存在的页码上
   */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (draft === null) return;

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      const urlQ = params.get("q") ?? "";
      const next = draft.trim();
      // 与 URL 已一致则跳过，防止「输入 → 同步 → 服务端回包 → 再同步」的空转
      if (next === urlQ) return;
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();

      // replace 不产生历史记录，避免连续输入塞满浏览器回退栈；refresh 让服务端按新 q 重新取数
      router.replace(qs ? `/posts?${qs}` : "/posts");
      router.refresh();
    }, DEBOUNCE_MS);
  }, [draft, router]);

  return (
    <div className="relative flex items-center">
      {/* 装饰性搜索图标，绝对定位于输入框左侧且不接收指针事件 */}
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
      {/* 有内容时才显示清空按钮；置空草稿即可触发防抖删除 q */}
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
