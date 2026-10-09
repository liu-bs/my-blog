/**
 * @file blog.ts
 * @description 博客文章域的核心类型集合：文章实体、列表查询参数、创建/更新 DTO 及各接口的响应数据结构。
 *              服务端 blog 域（repository/service/cache/controller）产出这些类型，
 *              前端页面与组件（文章列表、详情页、写作面板）消费它们，是前后端共用的单一事实来源。
 */
import type { AuthPayload } from "./user";

/**
 * 文章实体（对应数据库 Post 表的完整业务视图）
 * @description 时间字段均为 ISO 8601 字符串（如 `2026-01-01T08:00:00.000Z`），由服务端 Date 序列化而来。
 *              {@link PostUserStateData} 表示当前用户对某篇文章的点赞/收藏状态。
 */
export interface Post {
  /** 文章唯一 ID（数据库主键，cuid） */
  id: string;

  /** 文章标题 */
  title: string;

  /** 文章摘要，用于列表卡片展示，最长 500 字符 */
  summary: string;

  /** 文章正文（用于前端展示的渲染内容，详情页 SSR 后可能置空以减小 payload） */
  content: string;

  /** 原始 Markdown 正文，编辑面板回填时使用；列表页透传时为 undefined（节省体积） */
  contentRaw?: string;

  /** 所属分类名称，最长 50 字符 */
  category: string;

  /** 标签名列表 */
  tags: string[];

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string;

  /** 正式发布上线时间，ISO 8601 字符串；草稿状态尚未发布时为 undefined */
  publishedAt?: string;

  /** 是否为草稿：true-仅作者可见的草稿，false-已发布文章 */
  isDraft: boolean;

  /** 是否置顶，列表排序时优先展示；未设置视为 false */
  pinned?: boolean;

  /** 封面图 URL，无封面时为 undefined，前端渲染兜底占位图 */
  coverImage?: string;

  /** 作者用户 ID，对应 {@link User} 的 id；历史数据可能为空 */
  authorId?: string;

  /** 作者展示名称（冗余字段，避免列表页 N+1 查询用户表） */
  authorName?: string;

  /** 浏览量（累计阅读次数） */
  views: number;

  /** 点赞数（累计） */
  likes: number;

  /** 收藏数（累计），接口未返回该统计时为 undefined */
  favorites?: number;

  /** 评论数（累计） */
  commentsCount: number;
}

/**
 * 文章列表的 URL 查询参数（来自 searchParams，值均为字符串形态）
 * @description 与 {@link ListPostsOptions} 的区别：本类型面向 HTTP 查询串，
 *              draft 以字符串 "true" 表示；服务端经 normalizeListParams 转换后进入 service。
 */
export interface PostListParams {
  /** 是否筛选草稿：仅字面量 "true" 生效，用于作者后台列表 */
  draft?: "true";

  /** 按分类名筛选 */
  category?: string;

  /** 按标签名筛选 */
  tag?: string;

  /** 关键词搜索（匹配标题/摘要） */
  q?: string;

  /** 页码，从 1 开始，缺省为 1 */
  page?: number;

  /** 每页条数，缺省 10，对外接口上限 100 */
  limit?: number;
}

/**
 * 创建文章请求 DTO（写作面板提交的表单数据）
 * @description 服务端以 postCreateSchema（`@shared/validation/blog`）校验后落库。
 */
export interface CreatePostDto {
  /** 文章标题，非空 */
  title: string;

  /** 摘要，可选，最长 500 字符 */
  summary?: string;

  /** Markdown 正文，非空，最长 200000 字符 */
  content: string;

  /** 分类名称，非空，最长 50 字符 */
  category: string;

  /** 标签：支持逗号分隔字符串（总长 ≤300）或字符串数组（每个 ≤30 字符），缺省表示无标签 */
  tags?: string | string[];

  /** 是否保存为草稿：true-草稿，false-直接发布 */
  isDraft: boolean;

  /** 是否置顶，缺省 false */
  pinned?: boolean;

  /** 封面图 URL，缺省表示无封面 */
  coverImage?: string;
}

/**
 * 更新文章请求 DTO
 * @description {@link CreatePostDto} 的局部更新版本，所有字段可选，仅提交的字段会被写库。
 */
export type UpdatePostDto = Partial<CreatePostDto>;

/**
 * 更新文章 Server Action 的入参包
 */
export interface UpdatePostMutationVars {
  /** 待更新文章的 ID */
  id: string;

  /** 局部更新内容，见 {@link UpdatePostDto} */
  dto: UpdatePostDto;
}

/**
 * 文章列表接口响应数据
 */
export interface PostsListData {
  /** 当前页的文章列表 */
  posts: Post[];

  /** 符合筛选条件的文章总数（用于计算页码） */
  total: number;

  /** 当前页码，从 1 开始 */
  page: number;

  /** 当前每页条数 */
  limit: number;

  /** 总页数 */
  totalPages: number;
}

/**
 * 单篇文章详情接口响应数据
 */
export interface PostData {
  /** 文章实体 */
  post: Post;
}

/**
 * 点赞操作（Server Action）返回数据
 */
export interface LikeData {
  /** 操作后当前用户是否处于点赞状态（再次调用可切换） */
  liked: boolean;

  /** 操作后的文章总点赞数 */
  likes: number;
}

/**
 * 收藏切换操作（Server Action）返回数据
 */
export interface FavoriteToggleData {
  /** 操作后当前用户是否已收藏 */
  favorited: boolean;

  /** 操作后的文章总收藏数 */
  favorites: number;
}

/**
 * 当前用户对单篇文章的互动状态数据
 */
export interface PostUserStateData {
  /** 当前用户是否已点赞该文章 */
  liked: boolean;

  /** 当前用户是否已收藏该文章 */
  favorited: boolean;
}

/**
 * 全部分类列表接口响应数据
 */
export interface CategoriesData {
  /** 所有已使用分类的名称列表 */
  categories: string[];
}

/**
 * 全部标签列表接口响应数据
 */
export interface TagsData {
  /** 标签集合：name-标签名，count-该标签下已发布文章数 */
  tags: { name: string; count: number }[];
}

/**
 * 上一篇/下一篇导航接口响应数据
 */
export interface NeighborPostsData {
  /** 上一篇文章，已是首篇时为 null */
  prev: Post | null;

  /** 下一篇文章，已是末篇时为 null */
  next: Post | null;
}

/**
 * 服务端 listPosts（blog.service）的查询选项
 * @description 相比 HTTP 层的 {@link PostListParams}，本类型为解析后的服务端形态（draft 为布尔值），
 *              并附带鉴权与内部调用等仅服务端可见的字段。
 * @warning limit 会被服务端裁剪：普通调用取值范围 [1, 100]（缺省 10），internal 调用上限放宽至 20000；
 *          page 最小为 1。
 */
export interface ListPostsOptions {
  /** 是否查询草稿列表，true-含草稿筛选（仅作者本人可见），缺省 false 只返回已发布文章 */
  draft?: boolean;

  /** 按分类名筛选 */
  category?: string;

  /** 按标签名筛选 */
  tag?: string;

  /** 关键词搜索（匹配标题/摘要） */
  q?: string;

  /** 页码，从 1 开始，缺省 1 */
  page?: number;

  /** 每页条数，缺省 10；见 @warning 的上限说明 */
  limit?: number;

  /** 内部调用标记：服务端自用路径（缓存、带鉴权的后台列表、搜索）置 true，将 limit 上限放宽至 20000 */
  internal?: boolean;

  /** 当前请求用户的 JWT 载荷（{@link AuthPayload}），存在时草稿可见性等按作者身份判定 */
  user?: AuthPayload;
}
