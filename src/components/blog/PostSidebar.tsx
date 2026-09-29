/**
 * @file PostSidebar.tsx
 * @description 文章列表页的筛选侧栏：聚合分类导航与标签云两个区块，并承载列表主体（children）。
 * 桌面端（lg 及以上）侧栏常驻并以粘性定位吸附在导航栏下方；窄屏默认隐藏，改由顶部按钮展开/收起，
 * 每次点击筛选项后自动收起，避免遮挡列表
 */
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { tagClassFor, tagVariantFor } from "@/components/ui/Tag";
import { getCategoryLabel, ALL_CATEGORY } from "@/lib/category";
import type { PostSidebarProps } from "@shared";
import { buildPostsUrl } from "@/lib/buildPostsUrl";

/**
 * PostSidebar 列表筛选侧栏
 * @description 侧栏区块构成：分类列表（仅当分类多于一个时渲染，避免单分类场景出现无意义筛选）+ 标签云（仅当存在标签时渲染）；
 * 所有筛选项都以链接形式跳转，通过 buildPostsUrl 基于当前 query 增量改写，从而保留搜索词等其他筛选条件
 * @param props 组件入参 {@link PostSidebarProps}
 * @returns 顶部切换按钮 + 侧栏 + 列表主体
 */
export function PostSidebar({
  categories,
  tags,
  currentCategory,
  currentTag,
  children,
  zeroResults,
}: PostSidebarProps) {
  const t = useTranslations("posts");

  const tCommon = useTranslations("common");

  /** 窄屏下筛选面板是否展开；桌面端不受此值影响，始终通过 lg:block 展示 */
  const [showFilter, setShowFilter] = useState(false);

  /** 当前 URL 查询参数，作为改写筛选链接的基础，保证切换某一维度时其余条件不丢失 */
  const searchParams = useSearchParams();

  /** 搜索无结果的额外改动：连带清空搜索词 q，帮用户一键回到完整筛选；有结果时则保持 q 不变 */
  const clearQ: Record<string, string | null> = zeroResults ? { q: null } : {};

  /** 可选分类集合，用于快速判断当前分类是否仍然有效 */
  const validCategorySet = new Set(categories);

  /** 当前分类已不在可选分类中（分类被删除或改名）时置为 true，此时点击标签需顺带清掉这个失效分类 */
  const shouldClearCategory = !!(currentCategory && !validCategorySet.has(currentCategory));

  return (
    <>
      {/* 窄屏专用：切换筛选面板显隐的按钮，靠 lg:hidden 在桌面端隐藏；aria-expanded/aria-controls 与面板建立无障碍关联 */}
      <Button
        onClick={() => setShowFilter((v) => !v)}
        variant="outline"
        size="sm"
        aria-expanded={showFilter}
        aria-controls="posts-filter-panel"
        className="mb-5 lg:hidden"
      >
        {t("filter")}
        {/* 箭头随展开状态翻转 180 度，仅作视觉提示 */}
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden
          className={`transition-transform duration-[var(--duration-fast)] ease-smooth ${showFilter ? "rotate-180" : ""}`}
        />
      </Button>

      {/* 侧栏与内容的横向排布容器；窄屏改为纵向堆叠 */}
      <div className="flex gap-12 max-lg:flex-col">
        {/* 筛选面板本体：受 showFilter 控制窄屏显隐，桌面端强制 block；sticky-below-nav 让其吸附在顶部导航下方 */}
        <aside
          id="posts-filter-panel"
          className={`w-65 shrink-0 max-lg:w-full ${showFilter ? "block" : "hidden"} lg:block`}
        >
          <div className="sticky-below-nav content-stack-lg">
            {/* 分类区块：仅当分类数超过 1 时才有筛选意义 */}
            {categories.length > 1 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{t("categories")}</h3>
                <ul className="space-y-1">
                  {/* 逐个渲染分类项，active 表示当前选中分类 */}
                  {categories.map((name) => {
                    const active = currentCategory === name;
                    return (
                      <li key={name}>
                        {/* 分类跳转：选中态回传 null 以清掉 category 参数；切分类时同时清掉标签维度，避免两个筛选条件互相牵制造成空结果 */}
                        <Link
                          href={buildPostsUrl(searchParams, {
                            category: name !== ALL_CATEGORY ? name : null,
                            tag: null,
                            ...clearQ,
                          })}
                          onClick={() => setShowFilter(false)}
                          aria-pressed={active}

                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-(length:--type-xs) font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ease-smooth ${
                            active
                              ? "bg-accent text-page shadow-(--shadow-sm)"
                              : "text-body hover:bg-btn-hover-bg hover:text-heading"
                          }`}
                        >
                          <span>
                            {/* 「全部」用专属文案，其余分类经 getCategoryLabel 按当前语言映射展示名 */}
                            {name === ALL_CATEGORY
                              ? t("allCategories")
                              : getCategoryLabel(name, tCommon as (k: string) => string)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 标签云区块：无标签时整体不渲染 */}
            {tags.length > 0 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{t("tags")}</h3>
                <div className="flex flex-wrap gap-2">
                  {/* 逐个渲染标签；兼容两种入参形态：纯字符串或带文章数的对象 */}
                  {tags.map((item) => {
                    const tagName = typeof item === "string" ? item : item.name;
                    const tagCount = typeof item === "string" ? 0 : item.count;

                    // 再次点击同一标签即取消该筛选
                    const active = currentTag === tagName;
                    return (
                      <Link
                        key={tagName}
                        href={buildPostsUrl(searchParams, {
                          tag: active ? null : tagName,
                          // 当前分类已失效时顺带清掉分类参数，防止落在一个不存在的分类上
                          ...(shouldClearCategory ? { category: null } : {}),
                          ...clearQ,
                        })}
                        onClick={() => setShowFilter(false)}
                        aria-pressed={active}

                        className={`rounded-full px-3 py-1 text-(length:--type-2xs) leading-normal font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ${
                          active
                            ? "bg-accent text-page shadow-(--shadow-sm)"
                            : `${tagClassFor[tagVariantFor(tagName)]} hover:brightness-105`
                        }`}
                      >
                        {tagName}
                        {/* 仅当标签关联了文章数时才展示，形如「· 12」 */}
                        {tagCount > 0 && (
                          <span className="ml-1.5 opacity-60">{`· ${tagCount}`}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* 列表主体：由调用方传入，min-w-0 防止内部长内容撑破 flex 布局 */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
