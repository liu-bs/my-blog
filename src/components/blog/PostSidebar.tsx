/**
 * @file PostSidebar.tsx
 * @description 文章列表页筛选侧边栏：渲染分类列表与标签云，点击后通过 buildPostsUrl 基于当前
 * 查询参数生成新的筛选链接（互斥重置 tag/category/page）；移动端可折叠，桌面端常驻显示。
 * 当前分类不在合法列表时（非法 URL 参数）点击标签会顺带清除 category。
 */
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";
import { tagClassFor, tagVariantFor } from "@/components/ui/Tag";
import { ALL_CATEGORY } from "@/lib/category";
import type { PostSidebarProps } from "@shared";
import { buildPostsUrl } from "@/lib/buildPostsUrl";

/**
 * 文章列表筛选侧边栏
 * @param props {@link PostSidebarProps} categories 分类名列表、tags 标签（字符串或含 count 的对象）、
 * currentCategory/currentTag 当前选中项、children 为列表主内容区插槽、zeroResults 表示当前搜索零结果
 */
export function PostSidebar({
  categories,
  tags,
  currentCategory,
  currentTag,
  children,
  zeroResults,
}: PostSidebarProps) {
  /** 移动端筛选面板是否展开 */
  const [showFilter, setShowFilter] = useState(false);

  const searchParams = useSearchParams();

  // 零结果状态下，切换分类/标签时顺带清空搜索词 q
  const clearQ: Record<string, string | null> = zeroResults ? { q: null } : {};

  const validCategorySet = new Set(categories);

  /** 当前 URL 携带的 category 不在合法分类列表中时，点击标签需清除该非法值 */
  const shouldClearCategory = !!(currentCategory && !validCategorySet.has(currentCategory));

  return (
    <>
      {/* 移动端筛选开关按钮（桌面端隐藏），箭头随展开态旋转 */}
      <Button
        onClick={() => setShowFilter((v) => !v)}
        variant="outline"
        size="sm"
        aria-expanded={showFilter}
        aria-controls="posts-filter-panel"
        className="mb-5 lg:hidden"
      >
        {messages.posts.filter}

        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden
          className={`transition-transform duration-[var(--duration-fast)] ease-smooth ${showFilter ? "rotate-180" : ""}`}
        />
      </Button>

      <div className="flex gap-12 max-lg:flex-col">
        {/* 筛选面板：移动端受 showFilter 控制显隐，桌面端常驻 */}
        <aside
          id="posts-filter-panel"
          className={`w-65 shrink-0 max-lg:w-full ${showFilter ? "block" : "hidden"} lg:block`}
        >
          <div className="sticky-below-nav content-stack-lg">
            {/* 分类导航列表，选中项高亮；点击后移动端自动收起面板 */}
            {categories.length > 1 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{messages.posts.categories}</h3>
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
                          <span>{name === ALL_CATEGORY ? messages.posts.allCategories : name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 标签云：再次点击选中标签可取消筛选，带文章数时追加 "· 数量" */}
            {tags.length > 0 && (
              <div className="animate-fade-in">
                <h3 className="mb-3 filter-heading">{messages.posts.tags}</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((item) => {
                    // 标签可能是纯字符串或 { name, count } 对象，做兼容取值
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

        {/* 列表主内容区插槽 */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
