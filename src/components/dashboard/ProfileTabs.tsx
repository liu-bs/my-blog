"use client";

import { useState } from "react";
import { MessageCircle, PenLine, FileText, Bookmark, NotebookPen } from "lucide-react";
import { formatTemplate, texts } from "@/texts";
import { useTabListKeyboard } from "@/hooks/useTabListKeyboard";
import { PostCard } from "@/components/post/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RemoveFavoriteButton } from "./RemoveFavoriteButton";
import { DeletePostButton } from "@/components/post/DeletePostButton";
import { postEditPath, postPath } from "@shared";
import type { Post } from "@shared";

type Tab = "posts" | "drafts" | "favorites";

const TAB_ORDER: readonly Tab[] = ["posts", "drafts", "favorites"];

interface ProfileTabsProps {
  publishedPosts: Post[];

  favorites: Post[];

  drafts: Post[];
}

export function ProfileTabs({ publishedPosts, favorites, drafts }: ProfileTabsProps) {
  const [tab, setTab] = useState<Tab>("posts");

  const tabKeyNav = useTabListKeyboard(TAB_ORDER, setTab);

  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const [removedDraftIds, setRemovedDraftIds] = useState<string[]>([]);

  const favoriteList = favorites.filter((post) => !removedIds.includes(post.id));

  const draftList = drafts.filter((post) => !removedDraftIds.includes(post.id));

  return (
    <div className="min-w-0">
      <div className="segmented animate-fade-in" role="tablist" onKeyDown={tabKeyNav}>
        <button
          type="button"
          id="profile-tab-posts"
          data-tab="posts"
          role="tab"
          aria-selected={tab === "posts"}
          aria-controls="profile-panel-posts"
          tabIndex={tab === "posts" ? 0 : -1}
          onClick={() => setTab("posts")}
          className={`segmented-item ${tab === "posts" ? "segmented-item-on" : ""}`}
        >
          {formatTemplate(texts.profile.postsTab, { count: publishedPosts.length })}
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
          {formatTemplate(texts.profile.draftsTab, { count: draftList.length })}
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
          {formatTemplate(texts.profile.favoritesTab, { count: favoriteList.length })}
        </button>
      </div>

      {tab === "posts" && (
        <div
          className="mt-10"
          role="tabpanel"
          id="profile-panel-posts"
          aria-labelledby="profile-tab-posts"
        >
          {publishedPosts.length === 0 ? (
            <EmptyState
              icon={<FileText size={20} strokeWidth={2.5} />}
              title={texts.profile.noPostsTitle}
              description={texts.profile.noPostsDesc}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {texts.profile.writePost}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {publishedPosts.map((post) => (
                <PostCard
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
              title={texts.profile.noDraftsTitle}
              description={texts.profile.noDraftsDesc}
              action={
                <Button href="/write">
                  <PenLine size={16} strokeWidth={2.5} />
                  {texts.profile.writePost}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {draftList.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}

                  href={postEditPath(post.id)}
                  badge={
                    <span className="chip-sm">
                      <NotebookPen size={10} strokeWidth={2.5} />
                      {texts.profile.draftBadge}
                    </span>
                  }
                  readMoreLabel={texts.profile.continueEditing}
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
              title={texts.profile.noFavoritesTitle}
              description={texts.profile.noFavoritesDesc}
              action={
                <Button href="/posts" variant="ghost">
                  {texts.profile.browsePosts}
                </Button>
              }
            />
          ) : (
            <div className="card-list">
              {favoriteList.map((post) => (
                <PostCard
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
