/**
 * @file zh/profile.ts
 * @description 中文 - 个人主页文案（资料头部、统计项、文章 / 草稿 / 收藏三个页签及各自空态）
 */
const profile = {
  /** 已认证标识徽标 */
  verified: "已认证",
  /** 用户未填写简介时的占位文案 */
  noBio: "暂无简介",
  /** 统计项：文章数 */
  statsArticles: "文章",
  /** 统计项：获赞数（不同于浏览量） */
  statsLikes: "获赞",
  /** 统计项：阅读量 */
  statsViews: "阅读",
  /** 面向本人的「去写作」按钮，与空态里的 browsePosts 区分 */
  writeArticle: "写作",
  /** 进入资料编辑页的按钮 */
  editProfile: "编辑资料",
  /** 文章页签文案，{count} 为该用户的文章总数占位符 */
  articlesTab: "文章 · {count}",
  /** 草稿页签文案（仅本人可见），{count} 为草稿数占位符 */
  draftsTab: "草稿 · {count}",
  /** 收藏页签文案，{count} 为收藏数占位符 */
  favoritesTab: "收藏 · {count}",
  /** 文章页签空态标题 */
  noArticlesTitle: "还没有文章",
  /** 文章页签空态说明，引导开始写作 */
  noArticlesDesc: "开始写第一篇文章",
  /** 草稿页签空态标题 */
  noDraftsTitle: "没有草稿",
  /** 草稿页签空态说明 */
  noDraftsDesc: "保存的草稿会出现在这里",
  /** 收藏页签空态标题 */
  noFavoritesTitle: "还没有收藏",
  /** 收藏页签空态说明 */
  noFavoritesDesc: "收藏文章后会出现在这里",
  /** 草稿卡片上的状态徽标 */
  draftBadge: "草稿",
  /** 草稿卡片上的「继续编辑」按钮 */
  continueEditing: "继续编辑",
  /** 收藏卡片上的「取消收藏」按钮，点击后从收藏列表移除 */
  removeFavorite: "取消收藏",
  /** 作者角色徽标 */
  roleWriter: "作者",
  /** 空态里跳转文章列表的按钮 */
  browsePosts: "浏览文章",
};

export type Messages = typeof profile;
export default profile;
