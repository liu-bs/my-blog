/**
 * @file zh/post.ts
 * @description 中文 - 文章详情页文案（正文元信息、目录、点赞收藏、评论区、删除确认、上下篇导航）
 */
const post = {
  /** 阅读时长，{minutes} 为按正文篇幅估算的分钟数占位符 */
  readingTime: "约 {minutes} 分钟",

  /** 侧边目录区块的标题 */
  tocLabel: "文章目录",
  /** 目录导航容器的 aria-label */
  tocNav: "文章内导航",
  /** 顶部阅读进度条的 aria-label */
  readingProgress: "阅读进度",
  /** 目录入口按钮文案，与区块标题 tocLabel 分属不同控件 */
  toc: "目录",

  /** 点赞按钮未激活态文案（动词），已点赞后切换为 liked */
  like: "点赞",
  /** 点赞按钮已激活态文案（状态），激活后不可重复点赞 */
  liked: "已点赞",
  /** 浏览量统计项标签 */
  views: "浏览",
  /** 点赞数统计项标签，与下方按钮文案 like 同形但用途不同 */
  likes: "点赞",
  /** 收藏按钮未激活态文案（动词） */
  favorite: "收藏",
  /** 收藏按钮已激活态文案（状态） */
  favorited: "已收藏",
  /** 未登录时点击点赞的提示，引导去登录 */
  loginToLike: "登录后可点赞",
  /** 未登录时点击收藏的提示，引导去登录 */
  loginToFavorite: "登录后可收藏",
  /** 评论数统计，{count} 为评论总数占位符 */
  commentsCount: "{count} 条评论",

  /** 作者操作菜单里的编辑入口 */
  editPost: "编辑文章",
  /** 作者操作菜单里的删除入口 */
  deletePost: "删除文章",
  /** 删除文章的二次确认说明，需强调不可撤销 */
  deletePostDesc: "删除后无法恢复，文章及评论将被永久移除。",

  /** 评论区标题 */
  commentsTitle: "评论",
  /** 评论输入框占位符，含发送快捷键提示 */
  commentPlaceholder: "写下你的想法…（⌘/Ctrl+Enter 发送）",
  /** 提交空评论时的校验提示 */
  commentEmpty: "请输入评论内容",
  /** 发表评论按钮文案 */
  submitComment: "发表评论",
  /** 未登录提示的前半句，与 commentLoginAfter 拼成一句，中间会插入登录页链接 */
  commentLoginBefore: "登录",
  /** 未登录提示的后半句，与 commentLoginBefore 拼接；两段需成对修改，不可各自独立翻译 */
  commentLoginAfter: "后参与评论",
  /** 评论列表加载失败提示 */
  commentLoadError: "评论加载失败",
  /** 无评论空态标题 */
  noCommentsTitle: "还没有评论",
  /** 无评论空态说明文案 */
  noCommentsDesc: "抢沙发！",
  /** 加载更多评论按钮，{count} 为剩余未展示的评论数占位符 */
  loadMoreComments: "加载更多评论（剩 {count} 条）",
  /** 删除评论确认弹窗标题 */
  deleteCommentTitle: "删除评论",
  /** 删除评论确认弹窗描述 */
  deleteCommentDesc: "确认删除这条评论吗？此操作不可撤销。",
  /** 删除评论确认弹窗的确认按钮，与文章删除的 confirmDelete 分属不同弹窗 */
  confirmDeleteBtn: "确认删除",

  /** 文章底部的上一篇文章导航 */
  prevPost: "上一篇",
  /** 文章底部的下一篇文章导航 */
  nextPost: "下一篇",
};

export type Messages = typeof post;
export default post;
