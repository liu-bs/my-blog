/**
 * @file PostToc.tsx
 * @description 文章目录侧栏（桌面端展示）：从文章 DOM 提取 h2/h3 生成目录，支持目录跳转、
 *              当前章节高亮（IntersectionObserver 监听标题可见性）、阅读进度条与"当前/总数"指示；
 *              正文内容由客户端注入时经 MutationObserver 重新提取目录
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import type { PostTocProps, TocItem } from "@shared";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * PostToc 文章目录
 * @param articleId 文章容器元素ID，目录标题在该容器内提取
 */
export function PostToc({ articleId }: PostTocProps) {
  const t = useTranslations("post");

  /** 目录项列表（h2/h3），渲染前提取自文章 DOM */
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  /** 当前高亮的标题ID */
  const [activeId, setActiveId] = useState<string>("");

  /** 阅读进度（0~1），由 rAF 节流的滚动监听驱动 */
  const [progress, setProgress] = useState(0);

  /** 目录点击后的滚动锁定定时器：期间暂停 IntersectionObserver 的高亮更新 */
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 提取文章容器内 .article-content 下的 h2/h3 生成目录；
   * 缺失 id 的标题自动补 heading-{index}，默认高亮第一项
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

  /** 首次挂载提取目录；正文为客户端渐进注入时经 MutationObserver 触发重新提取 */
  useEffect(() => {
    extractHeadings();

    const article = document.getElementById(articleId);
    if (!article) return;
    const observer = new MutationObserver(() => extractHeadings());
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [articleId, extractHeadings]);

  /** 滚动进度：rAF 节流回调，按滚动位置占文档高度的比例计算 */
  useRafScroll((_scrollY, docHeight) => {
    setProgress(docHeight > 0 ? Math.min(_scrollY / docHeight, 1) : 0);
  });

  /**
   * 章节高亮：IntersectionObserver 监听各标题进入视口（顶部留 80px 导航偏移，底部收窄 70%），
   * 取视口内最靠上的可见标题为当前项；滚动锁定期间跳过更新
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
   * 目录项点击滚动：立即高亮目标项并加 800ms 锁定（期间 IntersectionObserver 不更新高亮），
   * 用户系统开启"减少动态效果"时改用瞬时定位
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

  /** 卸载时清理滚动锁定定时器，避免泄漏 */
  useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  /** 当前高亮项在目录中的下标，用于底部"n / total"指示 */
  const activeIndex = tocItems.findIndex((h) => h.id === activeId);

  return (
    <aside className="hidden shrink-0 lg:block" aria-label={t("tocLabel")}>
      <div className="sticky-below-nav animate-fade-in">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between meta-text">
            <span>{t("readingProgress")}</span>
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
            <div className="mb-4 flex items-center gap-2 filter-heading">
              <span className="inline-block h-3 w-0.5 rounded-full bg-current opacity-50" />
              {t("toc")}
              <span className="ml-1 chip-sm tracking-normal normal-case">{tocItems.length}</span>
            </div>

            <nav className="flex flex-col gap-1 border-l border-stroke" aria-label={t("tocNav")}>
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
