/**
 * @file blog.ts
 * @description 文章领域类型：文章实体、列表查询参数、创建/更新 DTO、分页列表数据，
 *              以及点赞/收藏/分类/标签/上下篇等文章相关接口数据结构
 */
import type { AuthPayload } from "./user";

/**
 * 文章实体
 */
export interface Post {
  /** 文章唯一 ID */
  id: string;

  /** 标题 */
  title: string;

  /** 摘要，用于列表与分享卡片，服务端可能自动截取 */
  summary: string;

  /** 渲染后的正文 HTML */
  content: string;

  /** 原始 Markdown 正文，仅编辑场景返回，普通列表可缺省 */
  contentRaw?: string;

  /** 分类名 */
  category: string;

  /** 标签名列表 */
  tags: string[];

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string;

  /** 发布时间，ISO 8601 字符串，草稿可缺省 */
  publishedAt?: string;

  /** 是否草稿 */
  isDraft: boolean;

  /** 是否置顶 */
  pinned?: boolean;

  /** 封面图 URL，可选 */
  coverImage?: string;

  /** 作者用户 ID */
  authorId?: string;

  /** 作者展示昵称 */
  authorName?: string;

  /** 浏览量 */
  views: number;

  /** 点赞数 */
  likes: number;

  /** 收藏数 */
  favorites?: number;

  /** 评论数 */
  commentsCount: number;
}

/**
 * 文章列表查询参数（作为 URL 查询串传递，布尔值以字符串表示）
 */
export interface PostListParams {
  /** 值为 "true" 时查询草稿列表 */
  draft?: "true";

  /** 按分类筛选 */
  category?: string;

  /** 按标签筛选 */
  tag?: string;

  /** 关键词搜索 */
  q?: string;

  /** 页码，从 1 开始 */
  page?: number;

  /** 每页条数 */
  limit?: number;
}

/**
 * 创建文章入参 DTO
 */
export interface CreatePostDto {
  /** 标题 */
  title: string;

  /** 摘要，留空由服务端自动截取正文 */
  summary?: string;

  /** 正文（Markdown） */
  content: string;

  /** 分类名 */
  category: string;

  /** 标签：接受单个字符串（服务端拆分）或字符串数组 */
  tags?: string | string[];

  /** 是否草稿 */
  isDraft: boolean;

  /** 是否置顶 */
  pinned?: boolean;

  /** 封面图 URL，须通过安全图片校验（https 或站内路径） */
  coverImage?: string;
}

/** 更新文章入参 DTO：创建 DTO 的全可选版本，支持部分更新 */
export type UpdatePostDto = Partial<CreatePostDto>;

/**
 * 更新文章的 Mutation 变量
 */
export interface UpdatePostMutationVars {
  /** 待更新的文章 ID */
  id: string;

  /** 更新内容 */
  dto: UpdatePostDto;
}

/**
 * 文章列表分页数据
 */
export interface PostsListData {
  /** 当前页文章列表 */
  posts: Post[];

  /** 符合条件的文章总数 */
  total: number;

  /** 当前页码 */
  page: number;

  /** 每页条数 */
  limit: number;

  /** 总页数 */
  totalPages: number;
}

/**
 * 单篇文章详情数据
 */
export interface PostData {
  /** 文章实体 */
  post: Post;
}

/**
 * 点赞操作结果
 */
export interface LikeData {
  /** 操作后是否处于已点赞状态 */
  liked: boolean;

  /** 操作后的最新点赞数 */
  likes: number;
}

/**
 * 收藏操作结果
 */
export interface FavoriteToggleData {
  /** 操作后是否处于已收藏状态 */
  favorited: boolean;

  /** 操作后的最新收藏数 */
  favorites: number;
}

/**
 * 当前用户对文章的互动状态
 */
export interface PostUserStateData {
  /** 是否已点赞 */
  liked: boolean;

  /** 是否已收藏 */
  favorited: boolean;
}

/**
 * 全部分类名列表
 */
export interface CategoriesData {
  /** 分类名数组 */
  categories: string[];
}

/**
 * 标签列表（含使用计数）
 */
export interface TagsData {
  /** 标签名与该标签下文章数 */
  tags: { name: string; count: number }[];
}

/**
 * 上/下篇相邻文章数据
 */
export interface NeighborPostsData {
  /** 上一篇文章，无则为 null */
  prev: Post | null;

  /** 下一篇文章，无则为 null */
  next: Post | null;
}

/**
 * 服务端查询文章列表的选项
 */
export interface ListPostsOptions {
  /** 是否查询草稿（仅作者本人可用） */
  draft?: boolean;

  /** 按分类筛选 */
  category?: string;

  /** 按标签筛选 */
  tag?: string;

  /** 关键词搜索 */
  q?: string;

  /** 页码，从 1 开始 */
  page?: number;

  /** 每页条数 */
  limit?: number;

  /** 标记内部调用（如 dashboard），返回包含草稿等未公开内容 */
  internal?: boolean;

  /** 当前登录用户，用于草稿/内部数据的权限判定 */
  user?: AuthPayload;
}
