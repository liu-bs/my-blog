/**
 * @file ProfileTabs.tsx
 * @description 个人主页内容标签页：在「已发布文章 / 草稿 / 收藏」三栏间切换，分别渲染对应文章卡列表与空状态
 * @usage 客户端组件；支持键盘方向键切换 tab（useTablistKeyboard）；本地记录已删除/已取消收藏的 ID 以即时从视图剔除
 */
"use client";

import { useState } from "react";
import { MessageCircle, PenLine, FileText, Bookmark, NotebookPen } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { useTablistKeyboard } from "@/hooks/useTablistKeyboard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RemoveFavoriteButton } from "./RemoveFavoriteButton";
import { DeletePostButton } from "@/components/blog/DeletePostButton";
import { postEditPath, postPath } from "@shared";
import type { Post } from "@shared";

/** 个人主页标签页标识 */
type Tab = "articles" | "drafts" | "favorites";

/** 标签顺序，供键盘左右切换按此序列移动焦点 */
const TAB_ORDER: readonly Tab[] = ["articles", "drafts", "favorites"];

/** ProfileTabs 组件入参 */
interface ProfileTabsProps {
  /** 已发布文章列表 */
  published: Post[];

  /** 收藏文章列表 */
  favorites: Post[];

  /** 草稿文章列表 */
  drafts: Post[];
}

/**
 * 个人主页内容标签页
 * @param props {@link ProfileTabsProps}
 * @returns 带 tablist 与三块 tabpanel 的切换视图
 */
export function ProfileTabs({ published, favorites, drafts }: ProfileTabsProps) {
  /** 当前激活的标签页 */
  const [tab, setTab] = useState<Tab>("articles");

  /** tablist 键盘导航事件处理器（方向键切换 tab） */
  const tabKeyNav = useTablistKeyboard(TAB_ORDER, setTab);

  /** 已在本地移除的收藏文章 ID（取消收藏成功后追加） */
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  /** 已在本地移除的草稿 ID（删除草稿成功后追加） */
  const [removedDraftIds, setRemovedDraftIds] = useState<string[]>([]);

  /** 过滤掉本地已移除项后的收藏列表 */
  const favoriteList = favorites.filter((p) => !removedIds.includes(p.id));

  /** 过滤掉本地已移除项后的草稿列表 */
  const draftList = drafts.filter((p) => !removedDraftIds.includes(p.id));

  return (
    <div className="min-w-0">
      {/* 标签切换栏（tablist）：已发布 / 草稿 / 收藏 */}
      <div className="segmented animate-fade-in" role="tablist" onKeyDown={tabKeyNav}>
        <button
          type="button"
          id="profile-tab-articles"
          data-tab="articles"
          role="tab"
          aria-selected={tab === "articles"}
          aria-controls="profile-panel-articles"
          tabIndex={tab === "articles" ? 0 : -1}
          onClick={() => setTab("articles")}
          className={`segmented-item ${tab === "articles" ? "segmented-item-on" : ""}`}
        >
          {formatTemplate(messages.profile.articlesTab, { count: published.length })}
        </button>
        <button
          type="button"
          id="profile-tab-drafts"
          data-tab="drafts"
          role="tab"
          aria-selected={tab === "drafts"}
          aria-controls="profile-panel-drafts"
          tabIndex={tab === "drafts" ? 0 : -1}
          onClick={() => setTab("drafts")}
          className={`segmented-item ${tab === "drafts" ? "segmented-item-on" : ""}`}
        >
          {formatTemplate(messages.profile.draftsTab, { count: draftList.length })}
        </button>
        <button
          type="button"
          id="profile-tab-favorites"
          data-tab="favorites"
          role="tab"
          aria-selected={tab === "favorites"}
          aria-controls="profile-panel-favorites"
          tabIndex={tab === "favorites" ? 0 : -1}
          onClick={() => setTab("favorites")}
          className={`segmented-item ${tab === "favorites" ? "segmented-item-on" : ""}`}
        >
          {formatTemplate(messages.profile.favoritesTab, { count: favoriteList.length })}
        </button>
      </div>

      {/* 「已发布」面板：空态引导撰写，否则渲染带评论数的文章卡 */}
      {tab === "articles" && (
        <div
          className="mt-10"
          role="tabpanel"
          id="profile-panel-articles"
          aria-labelledby="profile-tab-articles"
        >
          {published.length === 0 ? (
            <EmptyState
              icon={<FileText size={20} strokeWidth={2.5} />}
              title={messages.profile.noArticlesTitle}
              description={messages.profile.noArticlesDesc}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {messages.profile.writeArticle}
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

      {/* 「草稿」面板：空态引导撰写，否则渲染可继续编辑/删除的草稿卡 */}
      {tab === "drafts" && (
        <div
          className="mt-10"
          role="tabpanel"
          id="profile-panel-drafts"
          aria-labelledby="profile-tab-drafts"
        >
          {draftList.length === 0 ? (
            <EmptyState
              icon={<NotebookPen size={20} strokeWidth={2.5} />}
              title={messages.profile.noDraftsTitle}
              description={messages.profile.noDraftsDesc}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {messages.profile.writeArticle}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {draftList.map((post) => (
                <ArticleCard
                  key={post.id}
                  post={post}

                  href={postEditPath(post.id)}
                  badge={
                    <span className="chip-sm">
                      <NotebookPen size={10} strokeWidth={2.5} />
                      {messages.profile.draftBadge}
                    </span>
                  }
                  readMoreLabel={messages.profile.continueEditing}
                  actions={
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

      {/* 「收藏」面板：空态引导浏览，否则渲染可取消收藏的文章卡 */}
      {tab === "favorites" && (
        <div
          className="mt-10"
          role="tabpanel"
          id="profile-panel-favorites"
          aria-labelledby="profile-tab-favorites"
        >
          {favoriteList.length === 0 ? (
            <EmptyState
              icon={<Bookmark size={20} strokeWidth={2.5} />}
              title={messages.profile.noFavoritesTitle}
              description={messages.profile.noFavoritesDesc}
              action={
                <Button href="/posts" variant="ghost">
                  {messages.profile.browsePosts}
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
