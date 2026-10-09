/**
 * @file post.ts
 * @description 文章详情页（src/app/posts/[id]）文案：阅读时长、目录侧栏、点赞/收藏、
 * 作者操作与评论区（PostToc、PostHeadStats、PostActions、CommentsSection 等组件），经 messages.post 消费。
 */

/** 文章详情页文案集合 */
const post = {
  /** 预计阅读时长文案，{minutes} 由 estimateReadingTime 计算后插值 */
  readingTime: "约 {minutes} 分钟",

  /** 目录侧栏（PostToc）的标题 */
  tocLabel: "文章目录",

  /** 目录导航容器的无障碍标签 */
  tocNav: "文章内导航",

  /** 顶部阅读进度条的无障碍标签 */
  readingProgress: "阅读进度",

  /** 移动端目录折叠按钮的短标签 */
  toc: "目录",

  /** 点赞按钮未点赞态文案（PostActions） */
  like: "点赞",

  /** 点赞按钮已点赞态文案 */
  liked: "已点赞",

  /** 详情页统计数据：浏览量的标签 */
  views: "浏览",

  /** 详情页统计数据：点赞数的标签 */
  likes: "点赞",

  /** 收藏按钮未收藏态文案 */
  favorite: "收藏",

  /** 收藏按钮已收藏态文案 */
  favorited: "已收藏",

  /** 未登录用户点击/悬停点赞按钮时的提示 */
  loginToLike: "登录后可点赞",

  /** 未登录用户点击/悬停收藏按钮时的提示 */
  loginToFavorite: "登录后可收藏",

  /** 评论区标题的评论数，{count} 为总条数 */
  commentsCount: "{count} 条评论",

  /** 作者视角：编辑当前文章的入口按钮 */
  editPost: "编辑文章",

  /** 作者视角：删除当前文章的入口按钮 */
  deletePost: "删除文章",

  /** 删除文章确认弹窗的描述（DeletePostButton） */
  deletePostDesc: "删除后无法恢复，文章及评论将被永久移除。",

  /** 评论区标题 */
  commentsTitle: "评论",

  /** 评论输入框占位符，含快捷键提示 */
  commentPlaceholder: "写下你的想法…（⌘/Ctrl+Enter 发送）",

  /** 提交空评论时的校验提示 */
  commentEmpty: "请输入评论内容",

  /** 发表评论按钮文案 */
  submitComment: "发表评论",

  /** 未登录提示的前半段（引导登录） */
  commentLoginBefore: "登录",

  /** 未登录提示的后半段，与 commentLoginBefore 包裹登录链接 */
  commentLoginAfter: "后参与评论",

  /** 评论列表加载失败的提示 */
  commentLoadError: "评论加载失败",

  /** 评论空状态的标题 */
  noCommentsTitle: "还没有评论",

  /** 评论空状态的引导描述 */
  noCommentsDesc: "抢沙发！",

  /** 加载更多评论按钮，{count} 为剩余条数 */
  loadMoreComments: "加载更多评论（剩 {count} 条）",

  /** 删除评论确认弹窗标题 */
  deleteCommentTitle: "删除评论",

  /** 删除评论确认弹窗描述 */
  deleteCommentDesc: "确认删除这条评论吗？此操作不可撤销。",

  /** 删除评论确认弹窗的确认按钮 */
  confirmDeleteBtn: "确认删除",

  /** 文章底部上一篇导航链接 */
  prevPost: "上一篇",

  /** 文章底部下一篇导航链接 */
  nextPost: "下一篇",
};

/** 文章详情页文案默认导出 */
export default post;
