"use client";

import { useState } from "react";
import { MessageCircle, PenLine, FileText, Bookmark, NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTablistKeyboard } from "@/hooks/useTablistKeyboard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RemoveFavoriteButton } from "./RemoveFavoriteButton";
import { DeletePostButton } from "@/components/blog/DeletePostButton";
import { postEditPath, postPath } from "@shared";
import type { Post } from "@shared";

type Tab = "articles" | "drafts" | "favorites";

const TAB_ORDER: readonly Tab[] = ["articles", "drafts", "favorites"];

interface ProfileTabsProps {

  published: Post[];

  favorites: Post[];

  drafts: Post[];
}

export function ProfileTabs({ published, favorites, drafts }: ProfileTabsProps) {
  const t = useTranslations("profile");

  const [tab, setTab] = useState<Tab>("articles");

  const tabKeyNav = useTablistKeyboard(TAB_ORDER, setTab);

  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const [removedDraftIds, setRemovedDraftIds] = useState<string[]>([]);

  const favoriteList = favorites.filter((p) => !removedIds.includes(p.id));

  const draftList = drafts.filter((p) => !removedDraftIds.includes(p.id));

  return (
    <div className="min-w-0">

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
          {t("articlesTab", { count: published.length })}
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
          {t("draftsTab", { count: draftList.length })}
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
          {t("favoritesTab", { count: favoriteList.length })}
        </button>
      </div>

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

                  href={postEditPath(post.id)}
                  badge={
                    <span className="chip-sm">
                      <NotebookPen size={10} strokeWidth={2.5} />
                      {t("draftBadge")}
                    </span>
                  }
                  readMoreLabel={t("continueEditing")}
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
