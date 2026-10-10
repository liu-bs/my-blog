"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { texts } from "@/texts";
import type { PostSearchInputProps } from "@shared";

const DEBOUNCE_MS = 300;

export function PostSearchInput({ initialValue }: PostSearchInputProps) {
  const router = useRouter();

  const searchParams = useSearchParams();

  const [draft, setDraft] = useState<string | null>(null);

  const value = draft ?? initialValue;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const searchParamsRef = useRef(searchParams);

  if (draft !== null && initialValue.trim() === draft.trim()) setDraft(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  });

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
        placeholder={texts.postList.searchPlaceholder}
        aria-label={texts.postList.searchPlaceholder}
        className="input-focus h-10 w-full max-w-50 rounded-md border border-stroke-strong bg-card-bg py-0 pr-9 pl-9 text-(length:--type-xs) leading-normal text-body placeholder:text-faint"
      />

      {value && (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label={texts.postList.clearSearch}
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors duration-[var(--duration-fast)] hover:bg-btn-hover-bg hover:text-heading"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
