/**
 * @file PostSidebar.tsx
 * @description 文章列表页筛选侧栏：分类列表与标签云，点击经 buildPostsUrl 拼装查询参数跳转（URL 即筛选状态）；
 *              移动端折叠为可展开面板；零结果或分类失效时在链接中携带清空 q/category 的修复参数
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
 * PostSidebar 文章列表筛选侧栏
 * @param categories 可选分类列表（含"全部"）
 * @param tags 可选标签列表（字符串或带计数的对象）
 * @param currentCategory 当前 URL 中的分类筛选
 * @param currentTag 当前 URL 中的标签筛选
 * @param children 文章列表主体
 * @param zeroResults 当前筛选是否零结果（用于链接中附加清空关键词的参数）
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

  /** 移动端筛选面板展开状态 */
  const [showFilter, setShowFilter] = useState(false);

  /** 当前 URL 查询参数，作为 buildPostsUrl 拼装的基础 */
  const searchParams = useSearchParams();

  /** 零结果时附加清空搜索关键词 q 的参数，引导用户走出空态 */
  const clearQ: Record<string, string | null> = zeroResults ? { q: null } : {};

  /** 合法分类集合，用于识别 URL 中已失效的分类 */
  const validCategorySet = new Set(categories);

  /** URL 中的分类不在可选列表内（如文章数归零后），链接中需附带清空分类参数 */
  const shouldClearCategory = !!(currentCategory && !validCategorySet.has(currentCategory));

  return (
    <>
      <Button
        onClick={() => setShowFilter((v) => !v)}
        variant="outline"
        size="sm"
        aria-expanded={showFilter}
        aria-controls="posts-filter-panel"
        className="mb-5 lg:hidden"
      >
        {t("filter")}

        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden
          className={`transition-transform duration-[var(--duration-fast)] ease-smooth ${showFilter ? "rotate-180" : ""}`}
        />
      </Button>

      <div className="flex gap-12 max-lg:flex-col">
        <aside
          id="posts-filter-panel"
          className={`w-65 shrink-0 max-lg:w-full ${showFilter ? "block" : "hidden"} lg:block`}
        >
          <div className="sticky-below-nav content-stack-lg">
            {categories.length > 1 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{t("categories")}</h3>
                <ul className="space-y-1">
                  {categories.map((name) => {
                    const active = currentCategory === name;
                    return (
                      <li key={name}>
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

            {tags.length > 0 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{t("tags")}</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((item) => {
                    const tagName = typeof item === "string" ? item : item.name;
                    const tagCount = typeof item === "string" ? 0 : item.count;

                    const active = currentTag === tagName;
                    return (
                      <Link
                        key={tagName}
                        href={buildPostsUrl(searchParams, {
                          tag: active ? null : tagName,

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

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
