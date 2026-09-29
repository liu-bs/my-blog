/**
 * @file en/post.ts
 * @description 英文 - 文章详情页文案（正文元信息、目录、点赞收藏、评论区、删除确认、上下篇导航），与 zh/post.ts 逐 key 对应
 */
import type { Messages } from "../zh/post";

const post: Messages = {
  /** 阅读时长，{minutes} 为按正文篇幅估算的分钟数占位符 */
  readingTime: "{minutes} min read",
  /** 侧边目录区块的标题 */
  tocLabel: "Contents",
  /** 目录导航容器的 aria-label */
  tocNav: "In-article navigation",
  /** 顶部阅读进度条的 aria-label */
  readingProgress: "Reading progress",
  /** 目录入口按钮文案，与区块标题 tocLabel 分属不同控件 */
  toc: "Contents",
  /** 点赞按钮未激活态文案（动词），已点赞后切换为 liked */
  like: "Like",
  /** 点赞按钮已激活态文案（状态），激活后不可重复点赞 */
  liked: "Liked",
  /** 浏览量统计项标签 */
  views: "Views",
  /** 点赞数统计项标签，与下方按钮文案 like 同形但用途不同 */
  likes: "Likes",
  /** 收藏按钮未激活态文案（动词） */
  favorite: "Favorite",
  /** 收藏按钮已激活态文案（状态） */
  favorited: "Favorited",
  /** 未登录时点击点赞的提示，引导去登录 */
  loginToLike: "Sign in to like",
  /** 未登录时点击收藏的提示，引导去登录 */
  loginToFavorite: "Sign in to favorite",
  /** 评论数统计，{count} 为评论总数占位符 */
  commentsCount: "{count} comments",
  /** 作者操作菜单里的编辑入口 */
  editPost: "Edit",
  /** 作者操作菜单里的删除入口 */
  deletePost: "Delete",
  /** 删除文章的二次确认说明，需强调不可撤销 */
  deletePostDesc: "Cannot be undone. The post and all comments will be deleted.",
  /** 评论区标题 */
  commentsTitle: "Comments",
  /** 评论输入框占位符，含发送快捷键提示 */
  commentPlaceholder: "Share your thoughts… (⌘/Ctrl+Enter to send)",
  /** 提交空评论时的校验提示 */
  commentEmpty: "Comment cannot be empty",
  /** 发表评论按钮文案 */
  submitComment: "Comment",
  /** 未登录提示的前半句，与 commentLoginAfter 拼成一句，中间会插入登录页链接 */
  commentLoginBefore: "Sign in",
  /** 未登录提示的后半句，与 commentLoginBefore 拼接；两段需成对修改，不可各自独立翻译 */
  commentLoginAfter: " to join the conversation",
  /** 评论列表加载失败提示 */
  commentLoadError: "Failed to load comments",
  /** 无评论空态标题 */
  noCommentsTitle: "No comments yet",
  /** 无评论空态说明文案 */
  noCommentsDesc: "Be the first to jump in",
  /** 加载更多评论按钮，{count} 为剩余未展示的评论数占位符 */
  loadMoreComments: "Load more ({count} left)",
  /** 删除评论确认弹窗标题 */
  deleteCommentTitle: "Delete",
  /** 删除评论确认弹窗描述 */
  deleteCommentDesc: "This cannot be undone.",
  /** 删除评论确认弹窗的确认按钮，与文章删除的 confirmDelete 分属不同弹窗 */
  confirmDeleteBtn: "Delete",
  /** 文章底部的上一篇文章导航 */
  prevPost: "Previous post",
  /** 文章底部的下一篇文章导航 */
  nextPost: "Next post",
};

export default post;
