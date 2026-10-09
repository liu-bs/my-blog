/**
 * @file comment.ts
 * @description 评论域的类型集合：评论实体、发布/更新 DTO、列表响应与查询选项。
 *              服务端 comment 域（controller/service/repository）与前端评论区组件（CommentsSection 等）共用，
 *              内容长度约束与 `@shared/validation/comment` 的 COMMENT_MAX_LENGTH（2000）保持一致。
 */
import type { AuthPayload } from "./user";

/**
 * 评论实体（对应数据库 Comment 表的业务视图）
 * @description 时间字段为 ISO 8601 字符串。
 */
export interface Comment {
  /** 评论唯一 ID */
  id: string;

  /** 所属文章 ID，对应 {@link Post} 的 id */
  postId: string;

  /** 评论者用户 ID */
  userId: string;

  /** 评论者展示名称（冗余字段，避免联表查询） */
  userName: string;

  /** 评论者头像 URL，无头像时为 undefined，前端渲染首字母兜底 */
  userAvatar?: string;

  /** 评论正文，非空，最长 2000 字符（COMMENT_MAX_LENGTH） */
  content: string;

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最后编辑时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 发布/编辑评论请求 DTO
 */
export interface CreateCommentDto {
  /** 评论正文，去除首尾空白后非空，最长 2000 字符 */
  content: string;
}

/**
 * 评论列表接口响应数据
 */
export interface CommentsListData {
  /** 当前页的评论列表，按时间倒序 */
  comments: Comment[];

  /** 该文章的评论总数 */
  total: number;

  /** 是否还有下一页（前端"加载更多"按钮依据此字段显隐） */
  hasMore: boolean;
}

/**
 * 服务端 listComments（comment.service）的查询选项
 * @warning limit 会被服务端裁剪到 [1, 50]（缺省 10），offset 最小为 0。
 */
export interface ListCommentsOptions {
  /** 目标文章 ID，服务端会先校验该文章对当前访客可读 */
  postId: string;

  /** 当前请求用户的 JWT 载荷（{@link AuthPayload}），用于草稿文章评论的权限判定 */
  user?: AuthPayload;

  /** 每页条数，缺省 10，上限 50 */
  limit?: number;

  /** 偏移量（已加载条数），缺省 0，用于"加载更多"分页 */
  offset?: number;
}

/**
 * 编辑评论 Server Action 的入参包
 */
export interface UpdateCommentMutationVars {
  /** 待编辑评论的 ID */
  commentId: string;

  /** 新的评论内容，见 {@link CreateCommentDto} */
  dto: CreateCommentDto;
}
