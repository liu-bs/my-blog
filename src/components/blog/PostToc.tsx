/**
 * @file PostToc.tsx
 * @description 文章目录侧栏（桌面端）：从正文 DOM 提取 h2/h3 生成目录，MutationObserver 监听正文
 * 变化重新提取；滚动时同步"当前章节"高亮与阅读进度百分比；点击目录项平滑滚动定位。
 * 依赖正文容器 id={articleId} 且标题位于 .article-content 内。
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { messages } from "@/texts";
import type { PostTocProps, TocItem } from "@shared";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * 文章目录侧栏
 * @param articleId 正文容器元素 id，用于定位 h2/h3 标题
 */
export function PostToc({ articleId }: PostTocProps) {
  /** 目录条目列表（h2/h3 提取结果） */
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  /** 当前激活（阅读位置所在）的标题 id */
  const [activeId, setActiveId] = useState<string>("");

  /** 阅读进度，0~1 */
  const [progress, setProgress] = useState(0);

  /** 点击目录后的 IntersectionObserver 抑制计时器，避免滚动动画期间高亮抖动 */
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 从正文 DOM 提取 h2/h3 生成目录条目；无 id 的标题自动补 heading-{idx}，
   * 首个条目在尚无激活项时设为默认高亮
   */
  const extractHeadings = useCallback(() => {
    const article = document.getElementById(articleId);

    if (!article) return;
    const headings = Array.from(
      article.querySelectorAll(".article-content h2, .article-content h3"),
    ) as HTMLHeadingElement[];
    const items: TocItem[] = headings.map((h, idx) => {
      if (!h.id) h.id = `heading-${idx}`;
      return { id: h.id, text: h.textContent || "", sub: h.tagName === "H3" };
    });
    setTocItems(items);
    setActiveId((prev) => prev || items[0]?.id || "");
  }, [articleId]);

  /**
   * 首次提取目录，并用 MutationObserver 监听正文子树变化（如 Markdown 异步渲染）
   * 触发重新提取
   */
  useEffect(() => {
    extractHeadings();

    const article = document.getElementById(articleId);
    if (!article) return;
    const observer = new MutationObserver(() => extractHeadings());
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [articleId, extractHeadings]);

  // 基于 rAF 节流滚动，计算阅读进度（滚动距离/可滚动总高度，上限 1）
  useRafScroll((_scrollY, docHeight) => {
    setProgress(docHeight > 0 ? Math.min(_scrollY / docHeight, 1) : 0);
  });

  /**
   * 用 IntersectionObserver 监测标题进入视口以同步高亮；
   * rootMargin 上收 80px 避开导航栏、下收 70% 让"当前章节"判定更贴近阅读位置。
   * 点击目录后的 800ms 窗口内（scrollTimer 存在）暂停自动高亮。
   */
  useEffect(() => {
    if (tocItems.length === 0) return;
    const headings = tocItems
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollTimer.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [tocItems]);

  /**
   * 点击目录项：立即高亮并平滑滚动到目标标题，同时开启 800ms 抑制窗口
   * 防止滚动动画过程中自动高亮覆盖用户选择
   * @param headingId 目标标题元素 id
   */
  const scrollToHeading = useCallback((headingId: string) => {
    const el = document.getElementById(headingId);
    if (!el) return;
    setActiveId(headingId);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
    }, 800);

    el.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  /** 卸载时清理抑制计时器 */
  useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  /** 当前激活条目序号，用于底部 "n / total" 指示 */
  const activeIndex = tocItems.findIndex((h) => h.id === activeId);

  return (
    <aside className="hidden shrink-0 lg:block" aria-label={messages.post.tocLabel}>
      <div className="sticky-below-nav animate-fade-in">
        {/* 阅读进度条：百分比文案 + 进度填充 */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between meta-text">
            <span>{messages.post.readingProgress}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-full bg-stroke">
            <div
              className="h-full rounded-full bg-heading transition-[width] duration-[var(--duration-fast)] ease-smooth"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {tocItems.length > 0 && (
          <>
            {/* 目录标题 + 条目总数角标 */}
            <div className="mb-4 flex items-center gap-2 filter-heading">
              <span className="inline-block h-3 w-0.5 rounded-full bg-current opacity-50" />
              {messages.post.toc}
              <span className="ml-1 chip-sm tracking-normal normal-case">{tocItems.length}</span>
            </div>

            {/* 目录导航列表：h3 缩进小字，激活项高亮左边框 */}
            <nav
              className="flex flex-col gap-1 border-l border-stroke"
              aria-label={messages.post.tocNav}
            >
              {tocItems.map((h) => {
                const active = activeId === h.id;
                return (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToHeading(h.id);
                    }}
                    aria-current={active ? "location" : undefined}
                    aria-label={h.text}
                    title={h.text}
                    className={`block border-l-2 py-2 text-left leading-snug transition-[color,border-color] duration-[var(--duration-fast)] ease-smooth ${h.sub ? "pl-6 text-(length:--type-2xs)" : "pl-3 text-(length:--type-xs)"} ${active ? "-ml-px border-accent font-medium text-heading" : "-ml-px border-transparent text-muted hover:border-heading hover:text-heading"}`}
                  >
                    <span className="block truncate">{h.text}</span>
                  </a>
                );
              })}
            </nav>

            {/* 当前章节位置指示 */}
            {activeIndex >= 0 && (
              <div className="mt-4 meta-text">
                {activeIndex + 1} / {tocItems.length}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
