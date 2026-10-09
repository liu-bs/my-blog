/**
 * @file profile.ts
 * @description 个人中心页（src/app/(dashboard)/profile，ProfilePageContent/ProfileTabs/RemoveFavoriteButton 等）
 * 文案：作者信息、统计、文章/草稿/收藏标签页与空状态，经 messages.profile 消费。
 */

/** 个人中心页文案集合 */
const profile = {
  /** 作者已认证角标 */
  verified: "已认证",

  /** 用户未填简介时的占位文案 */
  noBio: "暂无简介",

  /** 统计项：文章数标签 */
  statsArticles: "文章",

  /** 统计项：获赞数标签 */
  statsLikes: "获赞",

  /** 统计项：阅读数标签 */
  statsViews: "阅读",

  /** 作者视角的去写作入口按钮 */
  writeArticle: "写作",

  /** 作者视角的去设置页编辑资料按钮 */
  editProfile: "编辑资料",

  /** 标签页：文章列表，{count} 为篇数 */
  articlesTab: "文章 · {count}",

  /** 标签页：草稿列表，{count} 为篇数 */
  draftsTab: "草稿 · {count}",

  /** 标签页：收藏列表，{count} 为篇数 */
  favoritesTab: "收藏 · {count}",

  /** 文章标签页空状态标题（访客视角） */
  noArticlesTitle: "还没有文章",

  /** 文章标签页空状态描述（作者视角引导） */
  noArticlesDesc: "开始写第一篇文章",

  /** 草稿标签页空状态标题 */
  noDraftsTitle: "没有草稿",

  /** 草稿标签页空状态描述 */
  noDraftsDesc: "保存的草稿会出现在这里",

  /** 收藏标签页空状态标题 */
  noFavoritesTitle: "还没有收藏",

  /** 收藏标签页空状态描述 */
  noFavoritesDesc: "收藏文章后会出现在这里",

  /** 草稿条目的状态角标 */
  draftBadge: "草稿",

  /** 草稿条目继续编辑的按钮 */
  continueEditing: "继续编辑",

  /** 收藏条目取消收藏的按钮（RemoveFavoriteButton） */
  removeFavorite: "取消收藏",

  /** 访客视角下作者的署名标签 */
  roleWriter: "作者",

  /** 访客视角去文章列表的引导按钮 */
  browsePosts: "浏览文章",
};

/** 个人中心页文案默认导出 */
export default profile;
