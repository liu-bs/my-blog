/**
 * @file ProfileTabs.tsx
 * @description 个人主页右侧的文章/草稿/收藏三个 Tab 切换与列表渲染。
 * Tab 状态保存在组件本地（未同步到 URL），因此刷新页面会回到默认的「文章」Tab；
 * 删除草稿、取消收藏均在本地维护一份已移除 ID 列表做即时隐藏，避免整页刷新。
 */
"use client";

import { useState } from "react";
import { MessageCircle, PenLine, FileText, Bookmark, NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RemoveFavoriteButton } from "./RemoveFavoriteButton";
import { DeletePostButton } from "@/components/blog/DeletePostButton";
import { postEditPath, postPath } from "@shared";
import type { Post } from "@shared";

/** 可切换的 Tab 标识 */
type Tab = "articles" | "drafts" | "favorites";

/**
 * ProfileTabs 入参
 */
interface ProfileTabsProps {
  /** 已发布的文章列表 */
  published: Post[];

  /** 收藏的文章列表 */
  favorites: Post[];

  /** 草稿列表 */
  drafts: Post[];
}

/**
 * ProfileTabs 个人主页标签页
 * @param props {@link ProfileTabsProps}
 * @returns 标签切换栏 + 当前标签对应的文章列表或空态
 */
export function ProfileTabs({ published, favorites, drafts }: ProfileTabsProps) {
  const t = useTranslations("profile");

  /** 当前选中的标签页，仅本地状态，不回写 URL */
  const [tab, setTab] = useState<Tab>("articles");

  /** 已取消收藏的文章 ID；用于在不重新取数的情况下把条目从收藏列表隐去 */
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  /** 已删除的草稿 ID；同样用于本地即时移除 */
  const [removedDraftIds, setRemovedDraftIds] = useState<string[]>([]);

  /** 过滤掉本地已取消收藏的条目后，实际用于渲染的收藏列表 */
  const favoriteList = favorites.filter((p) => !removedIds.includes(p.id));

  /** 过滤掉本地已删除的条目后，实际用于渲染的草稿列表 */
  const draftList = drafts.filter((p) => !removedDraftIds.includes(p.id));

  return (
    <div className="min-w-0">
      {/* 标签切换栏，计数展示的是「本地过滤后」的数量，能即时反映删除/取消收藏的结果 */}
      <div className="segmented animate-fade-in">
        <button
          type="button"
          onClick={() => setTab("articles")}
          role="tab"
          aria-selected={tab === "articles"}
          className={`segmented-item ${tab === "articles" ? "segmented-item-on" : ""}`}
        >
          {t("articlesTab", { count: published.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab("drafts")}
          role="tab"
          aria-selected={tab === "drafts"}
          className={`segmented-item ${tab === "drafts" ? "segmented-item-on" : ""}`}
        >
          {t("draftsTab", { count: draftList.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab("favorites")}
          role="tab"
          aria-selected={tab === "favorites"}
          className={`segmented-item ${tab === "favorites" ? "segmented-item-on" : ""}`}
        >
          {t("favoritesTab", { count: favoriteList.length })}
        </button>
      </div>

      {/* 已发布文章列表 */}
      {tab === "articles" && (
        <div className="mt-10">
          {published.length === 0 ? (
            // 空态引导用户去写文章
            <EmptyState
              icon={<FileText size={20} strokeWidth={2.5} />}
              title={t("noArticlesTitle")}
              description={t("noArticlesDesc")}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {t("writeArticle")}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {published.map((post) => (
                <ArticleCard
                  key={post.id}
                  post={post}
                  href={postPath(post.id)}
                  // 已在个人主页，额外展示评论数（点击进入正文阅读详情）
                  extraStats={[
                    {
                      icon: <MessageCircle size={12} strokeWidth={2.5} />,
                      value: post.commentsCount || 0,
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 草稿列表 */}
      {tab === "drafts" && (
        <div className="mt-10">
          {draftList.length === 0 ? (
            // 空态引导用户去写文章
            <EmptyState
              icon={<NotebookPen size={20} strokeWidth={2.5} />}
              title={t("noDraftsTitle")}
              description={t("noDraftsDesc")}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {t("writeArticle")}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {draftList.map((post) => (
                <ArticleCard
                  key={post.id}
                  post={post}
                  // 草稿点击进入编辑页而非详情页
                  href={postEditPath(post.id)}
                  badge={
                    <span className="chip-sm">
                      <NotebookPen size={10} strokeWidth={2.5} />
                      {t("draftBadge")}
                    </span>
                  }
                  readMoreLabel={t("continueEditing")}
                  actions={
                    // 删除成功后把 ID 记入 removedDraftIds，列表即时移除该草稿
                    <DeletePostButton
                      postId={post.id}
                      variant="compact"
                      onRemoved={() => setRemovedDraftIds((ids) => [...ids, post.id])}
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 收藏列表 */}
      {tab === "favorites" && (
        <div className="mt-10">
          {favoriteList.length === 0 ? (
            // 空态引导用户去文章列表浏览
            <EmptyState
              icon={<Bookmark size={20} strokeWidth={2.5} />}
              title={t("noFavoritesTitle")}
              description={t("noFavoritesDesc")}
              action={
                <Button href="/posts" variant="ghost">
                  {t("browsePosts" as never)}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {favoriteList.map((post) => (
                <ArticleCard
                  key={post.id}
                  post={post}
                  href={postPath(post.id)}
                  actions={
                    // 取消收藏成功后把 ID 记入 removedIds，收藏列表即时移除该条
                    <RemoveFavoriteButton
                      postId={post.id}
                      onRemoved={() => setRemovedIds((ids) => [...ids, post.id])}
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
