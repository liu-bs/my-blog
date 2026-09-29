/**
 * @file en/profile.ts
 * @description 英文 - 个人主页文案（资料头部、统计项、文章 / 草稿 / 收藏三个页签及各自空态），与 zh/profile.ts 逐 key 对应
 */
import type { Messages } from "../zh/profile";

const profile: Messages = {
  /** 已认证标识徽标 */
  verified: "Verified",
  /** 用户未填写简介时的占位文案 */
  noBio: "No bio yet",
  /** 统计项：文章数 */
  statsArticles: "Posts",
  /** 统计项：获赞数（不同于浏览量） */
  statsLikes: "Likes",
  /** 统计项：阅读量 */
  statsViews: "Views",
  /** 面向本人的「去写作」按钮，与空态里的 browsePosts 区分 */
  writeArticle: "Write",
  /** 进入资料编辑页的按钮 */
  editProfile: "Edit",
  /** 文章页签文案，{count} 为该用户的文章总数占位符 */
  articlesTab: "Posts · {count}",
  /** 草稿页签文案（仅本人可见），{count} 为草稿数占位符 */
  draftsTab: "Drafts · {count}",
  /** 收藏页签文案，{count} 为收藏数占位符 */
  favoritesTab: "Favorites · {count}",
  /** 文章页签空态标题 */
  noArticlesTitle: "No posts yet",
  /** 文章页签空态说明，引导开始写作 */
  noArticlesDesc: "Start writing your first post",
  /** 草稿页签空态标题 */
  noDraftsTitle: "No drafts",
  /** 草稿页签空态说明 */
  noDraftsDesc: "Saved drafts appear here",
  /** 收藏页签空态标题 */
  noFavoritesTitle: "No favorites yet",
  /** 收藏页签空态说明 */
  noFavoritesDesc: "Favorited posts appear here",
  /** 草稿卡片上的状态徽标 */
  draftBadge: "Draft",
  /** 草稿卡片上的「继续编辑」按钮 */
  continueEditing: "Keep editing",
  /** 收藏卡片上的「取消收藏」按钮，点击后从收藏列表移除 */
  removeFavorite: "Unfavorite",
  /** 作者角色徽标 */
  roleWriter: "Writer",
  /** 空态里跳转文章列表的按钮 */
  browsePosts: "Browse posts",
};

export default profile;
