/**
 * @file blog.ts
 * @description 博客文章领域的共享类型：文章实体、列表查询参数、增改 DTO，以及各类列表 / 计数 / 相邻文章响应结构。
 *              这些类型被服务端 blog 领域与服务端渲染页面共同引用，字段含义需与页面展示保持一致。
 */
import type { AuthPayload } from "./user";

/**
 * 文章实体
 * @description 文章在前后端之间传输的完整形态。列表查询会省略正文等重字段（见各字段说明），
 *              详情查询才返回完整内容。
 */
export interface Post {
  /** 文章唯一标识（PK），路由与接口均以它定位文章 */
  id: string;

  /** 文章标题 */
  title: string;

  /** 文章摘要，用于列表卡片与 SEO description */
  summary: string;

  /** 渲染后的正文 HTML，详情页渲染用 */
  content: string;

  /** 正文原始文本，仅编辑回填时返回，列表与公开详情接口通常不带该字段以减小体积 */
  contentRaw?: string;

  /** 所属分类名（单值） */
  category: string;

  /** 标签名列表 */
  tags: string[];

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最近更新时间，ISO 8601 字符串 */
  updatedAt: string;

  /** 首次发布时间，ISO 8601 字符串；草稿从未发布时为空 */
  publishedAt?: string;

  /** 是否为草稿，草稿仅在作者本人的后台可见 */
  isDraft: boolean;

  /** 是否置顶，置顶文章在列表中优先排序；旧数据可能缺失该字段 */
  pinned?: boolean;

  /** 封面图地址，为空时前端使用占位图 */
  coverImage?: string;

  /** 作者用户 ID，用于「是否本文作者」等权限判断 */
  authorId?: string;

  /** 作者展示名（姓名或用户名），列表页直接展示以避免额外查询 */
  authorName?: string;

  /** 浏览量计数 */
  views: number;

  /** 点赞数 */
  likes: number;

  /** 收藏数 */
  favorites?: number;

  /** 评论数，列表页展示用 */
  commentsCount: number;
}

/**
 * 文章列表的原始查询参数
 * @description 直接映射 URL query string，因此所有字段都是字符串类型；`draft` 用字符串 "true" 表示（见 normalizeListParams）。
 */
export interface PostListParams {
  /** 是否只看草稿，URL 中以字符串 "true" 表示开启 */
  draft?: "true";

  /** 按分类过滤 */
  category?: string;

  /** 按标签过滤 */
  tag?: string;

  /** 全文搜索关键词 */
  q?: string;

  /** 页码，从 1 开始 */
  page?: number;

  /** 每页条数 */
  limit?: number;
}

/**
 * 创建文章的入参 DTO
 * @description 来自写文章表单，标签同时兼容「逗号分隔字符串」与「字符串数组」两种提交形态。
 */
export interface CreatePostDto {
  /** 标题，必填 */
  title: string;

  /** 摘要，可选，留空时由服务端从正文截取 */
  summary?: string;

  /** 正文，必填 */
  content: string;

  /** 分类名，必填 */
  category: string;

  /** 标签，可为逗号分隔字符串或字符串数组，由服务端归一化 */
  tags?: string | string[];

  /** 是否为草稿，必填（无默认值，避免误发布） */
  isDraft: boolean;

  /** 是否置顶 */
  pinned?: boolean;

  /** 封面图地址 */
  coverImage?: string;
}

/**
 * 更新文章的入参 DTO
 * @description 基于创建 DTO 派生为全可选，只提交需要变更的字段（PATCH 语义）
 */
export type UpdatePostDto = Partial<CreatePostDto>;

/**
 * 更新文章 Mutation 的变量
 * @description 同时携带目标文章 id 与要更新的字段，供前端 mutation 使用
 */
export interface UpdatePostMutationVars {
  /** 目标文章 ID */
  id: string;

  /** 待更新的字段集合 */
  dto: UpdatePostDto;
}

/**
 * 文章列表接口的响应数据
 */
export interface PostsListData {
  /** 当前页文章列表 */
  posts: Post[];

  /** 过滤后的总条数 */
  total: number;

  /** 当前页码，从 1 开始 */
  page: number;

  /** 每页条数 */
  limit: number;

  /** 总页数，由 total 与 limit 计算得出 */
  totalPages: number;
}

/**
 * 文章详情接口的响应数据
 */
export interface PostData {
  /** 单篇文章完整数据 */
  post: Post;
}

/**
 * 点赞切换结果
 */
export interface LikeData {
  /** 操作后的点赞状态：true 表示当前用户已点赞 */
  liked: boolean;

  /** 操作后的最新点赞总数 */
  likes: number;
}

/**
 * 收藏切换结果
 */
export interface FavoriteToggleData {
  /** 操作后的收藏状态：true 表示当前用户已收藏 */
  favorited: boolean;

  /** 操作后的最新收藏总数 */
  favorites: number;
}

/**
 * 当前用户对某篇文章的互动状态
 * @description 详情页初次加载时批量拉取，避免分别请求点赞与收藏状态
 */
export interface PostUserStateData {
  /** 当前用户是否已点赞 */
  liked: boolean;

  /** 当前用户是否已收藏 */
  favorited: boolean;
}

/**
 * 分类列表接口的响应数据
 */
export interface CategoriesData {
  /** 全部分类名列表 */
  categories: string[];
}

/**
 * 标签列表接口的响应数据
 */
export interface TagsData {
  /** 标签及其文章数量，count 用于侧边栏按热度展示 */
  tags: { name: string; count: number }[];
}

/**
 * 相邻文章接口的响应数据
 * @description 详情页底部「上一篇 / 下一篇」导航，处于边界时为 null
 */
export interface NeighborPostsData {
  /** 上一篇文章，无上一篇时为 null */
  prev: Post | null;

  /** 下一篇文章，无下一篇时为 null */
  next: Post | null;
}

/**
 * 服务端内部文章列表查询选项
 * @description 与面向 URL 的 {@link PostListParams} 不同，这里的 `draft` 已是布尔值，
 *              并额外携带鉴权上下文与 internal 标记，供 Service 层直接消费。
 */
export interface ListPostsOptions {
  /** 是否包含 / 仅包含草稿（true 需有权限，草稿对外不可见） */
  draft?: boolean;

  /** 按分类过滤 */
  category?: string;

  /** 按标签过滤 */
  tag?: string;

  /** 全文搜索关键词 */
  q?: string;

  /** 页码，从 1 开始 */
  page?: number;

  /** 每页条数，内部调用上限可放宽（见 internal） */
  limit?: number;

  /** 是否内部调用：为 true 时放开 limit 上限并跳过公开列表的可见性收敛，仅限服务端自身使用 */
  internal?: boolean;

  /** 当前鉴权负载，用于判定草稿可见性与作者过滤 */
  user?: AuthPayload;
}
