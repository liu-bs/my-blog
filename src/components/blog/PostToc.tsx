/**
 * @file PostToc.tsx
 * @description 文章详情页右侧目录：客户端扫描正文容器内的 H2/H3 生成层级目录，实时高亮当前阅读章节，
 * 顶部展示整页阅读进度。桌面端（lg 及以上）常驻显示，窄屏整体隐藏（依赖页面自身的滚动位置判断即可）。
 * 目录生成与高亮全部基于 DOM，故完全依赖客户端运行时
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import type { PostTocProps, TocItem } from "@shared";
import { useRafScroll } from "@/hooks/useRafScroll";

/**
 * PostToc 文章目录（Table of Contents）
 * @description 职责拆成三块：① 扫描正文标题生成目录，并用 MutationObserver 跟随正文变更（如评论/懒加载内容插入）重算；
 * ② 用 IntersectionObserver 判定当前可视章节并高亮；③ 点击目录项平滑滚动到对应标题。
 * 标题缺失时的降级：正文容器不存在则目录为空、整块不渲染；标题没有 id 时按序号补 `heading-{idx}` 兜底，保证锚点可用
 * @param props 组件入参 {@link PostTocProps}
 * @param props.articleId 正文容器的元素 id，据它定位标题与滚动目标
 * @returns 目录侧栏；未扫描到任何标题时仅保留阅读进度条
 */
export function PostToc({ articleId }: PostTocProps) {
  const t = useTranslations("post");

  /** 扫描出的目录项，按正文中出现顺序排列，H3 以 sub 标记为次级 */
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  /** 当前高亮章节的标题 id；空串表示尚未定位到任何章节 */
  const [activeId, setActiveId] = useState<string>("");

  /** 整页阅读进度，取值 0~1，用于进度条宽度与百分比文案 */
  const [progress, setProgress] = useState(0);

  /** 点击目录跳转后的短暂冷却计时器：平滑滚动期间让出高亮判定权，避免滚动途中错点亮别的章节；null 表示无冷却 */
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 扫描正文标题并重建目录
   * @description 仅收 H2/H3 两类作为层级；H3 标记 sub=true 供缩进渲染。
   * 标题无 id 时补 `heading-{idx}` 兜底，使其仍可作为锚点与高亮目标；activeId 只在尚未初始化时取首项，不覆盖用户当前阅读位置
   */
  const extractHeadings = useCallback(() => {
    const article = document.getElementById(articleId);
    // 正文容器尚未挂载或已被卸载：保持目录现状，不做任何降级渲染
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
   * 首次扫描并持续监听正文结构变化
   * @description 正文可能因懒加载或评论插入而变化，用 MutationObserver 监听子树增删后重算目录；
   * 卸载时断开观察，避免对已移除节点继续持有引用
   */
  useEffect(() => {
    extractHeadings();

    const article = document.getElementById(articleId);
    if (!article) return;
    const observer = new MutationObserver(() => extractHeadings());
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [articleId, extractHeadings]);

  /**
   * 跟随页面滚动计算阅读进度
   * @description useRafScroll 已做 requestAnimationFrame 节流；
   * docHeight 为可滚动高度，为 0（内容不足一屏）时进度归零，并对结果取 min(…,1) 防止弹性滚动/缩放导致溢出
   */
  useRafScroll((_scrollY, docHeight) => {
    setProgress(docHeight > 0 ? Math.min(_scrollY / docHeight, 1) : 0);
  });

  /**
   * 观察各标题的可见性以判定当前章节
   * @description rootMargin 上方留 80px 抵消固定导航遮挡、下方收掉 70% 视口，使「章节顶部刚进入视口上缘」即被选中；
   * 同一帧可能有多个标题相交，取位置最靠上的一个。跳转冷却期内直接忽略，避免平滑滚动途中的中间态误改高亮
   */
  useEffect(() => {
    if (tocItems.length === 0) return;
    const headings = tocItems
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 点击跳转后的冷却期内不响应观察结果，把高亮决定权交还给点击方
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
   * 平滑滚动到指定标题
   * @description 先立即高亮目标项（而非等滚动结束），并开启 800ms 冷却，让 IntersectionObserver 在滚动期间暂停改写高亮；
   * 目标元素不存在时直接返回，避免锚点失效报错
   * @param headingId 目标标题的 DOM id
   */
  const scrollToHeading = useCallback((headingId: string) => {
    const el = document.getElementById(headingId);
    if (!el) return;
    setActiveId(headingId);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
    }, 800);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** 卸载时清理冷却计时器，防止组件已卸载后回调仍被执行 */
  useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  /** 当前高亮项在目录中的序号，-1 表示未匹配到任何项 */
  const activeIndex = tocItems.findIndex((h) => h.id === activeId);

  return (
    /* 目录侧栏：lg 以下整体隐藏 */
    <aside className="hidden shrink-0 lg:block" aria-label={t("tocLabel")}>
      <div className="sticky-below-nav animate-fade-in">
        {/* 阅读进度区：文案百分比 + 进度条 */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between meta-text">
            <span>{t("readingProgress")}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>

          {/* 进度条：内层宽度按 progress 百分比伸缩，配合过渡动画平滑推进 */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-stroke">
            <div
              className="h-full rounded-full bg-heading transition-[width] duration-[var(--duration-fast)] ease-smooth"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* 仅在扫描到标题时渲染目录；无标题时上方进度条仍保留 */}
        {tocItems.length > 0 && (
          <>
            {/* 目录标题栏，chip 中展示章节总数 */}
            <div className="mb-4 flex items-center gap-2 filter-heading">
              <span className="inline-block h-3 w-0.5 rounded-full bg-current opacity-50" />
              {t("toc")}
              <span className="ml-1 chip-sm tracking-normal normal-case">{tocItems.length}</span>
            </div>

            <nav className="flex flex-col gap-1 border-l border-stroke" aria-label={t("tocNav")}>
              {/* 逐项渲染，按 sub 区分层级：H3 缩进更深、字号更小，并以不同左侧边框色表达高亮 */}
              {tocItems.map((h) => {
                const active = activeId === h.id;
                return (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      // 阻止默认跳转（会丢失平滑滚动），改由 scrollToHeading 处理
                      e.preventDefault();
                      scrollToHeading(h.id);
                    }}
                    aria-current={active ? "location" : undefined}
                    aria-label={h.text}
                    title={h.text}
                    className={`block border-l-2 py-2 text-left leading-snug transition-[color,border-color] duration-[var(--duration-fast)] ease-smooth ${h.sub ? "pl-6 text-(length:--type-2xs)" : "pl-3 text-(length:--type-xs)"} ${active ? "-ml-px border-accent font-medium text-heading" : "-ml-px border-transparent text-muted hover:border-heading hover:text-heading"}`}
                  >
                    {/* 目录项文案，超长时单行截断 */}
                    <span className="block truncate">{h.text}</span>
                  </a>
                );
              })}
            </nav>

            {/* 底部序号指示：当前第几节 / 总节数 */}
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
