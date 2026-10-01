/**
 * @file profile.ts
 * @description 英文文案 - 个人主页：认证标识、统计数据、文章/草稿/收藏标签页及空态提示
 */
import type { Messages } from "../zh/profile";

/**
 * 个人主页文案集合
 */
const profile: Messages = {
  verified: "Verified",

  noBio: "No bio yet",

  statsArticles: "Posts",

  statsLikes: "Likes",

  statsViews: "Views",

  writeArticle: "Write",

  editProfile: "Edit",

  articlesTab: "Posts · {count}",

  draftsTab: "Drafts · {count}",

  favoritesTab: "Favorites · {count}",

  noArticlesTitle: "No posts yet",

  noArticlesDesc: "Start writing your first post",

  noDraftsTitle: "No drafts",

  noDraftsDesc: "Saved drafts appear here",

  noFavoritesTitle: "No favorites yet",

  noFavoritesDesc: "Favorited posts appear here",

  draftBadge: "Draft",

  continueEditing: "Keep editing",

  removeFavorite: "Unfavorite",

  roleWriter: "Writer",

  browsePosts: "Browse posts",
};

export default profile;
