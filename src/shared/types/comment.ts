/**
 * @file comment.ts
 * @description 文章评论领域的共享类型：评论实体、发表评论 DTO、评论列表响应与查询选项。
 *              评论需要登录才能发表，删除权限由服务端校验（评论作者或文章作者）。
 */
import type { AuthPayload } from "./user";

/**
 * 评论实体
 * @description 已冗余作者展示信息（userName / userAvatar），列表渲染无需再关联查询用户表。
 */
export interface Comment {
  /** 评论唯一标识 */
  id: string;

  /** 所属文章 ID */
  postId: string;

  /** 评论作者用户 ID，用于删除权限判断（作者本人或文章作者可删） */
  userId: string;

  /** 评论作者展示名 */
  userName: string;

  /** 评论作者头像地址，用户未设置头像时为空 */
  userAvatar?: string;

  /** 评论正文（纯文本 / 受限 Markdown） */
  content: string;

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最近编辑时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 发表评论的入参 DTO
 */
export interface CreateCommentDto {
  /** 评论正文，长度上限见 createCommentSchema */
  content: string;
}

/**
 * 评论列表接口的响应数据
 * @description 采用基于 offset 的分页，`hasMore` 供前端「加载更多」判断。
 */
export interface CommentsListData {
  /** 当前批次的评论列表 */
  comments: Comment[];

  /** 该文章评论总数，用于展示计数 */
  total: number;

  /** 是否还有更多评论可加载 */
  hasMore: boolean;
}

/**
 * 服务端评论列表查询选项
 */
export interface ListCommentsOptions {
  /** 目标文章 ID，必填 */
  postId: string;

  /** 当前鉴权负载，用于标记「可删除」等前端按钮状态 */
  user?: AuthPayload;

  /** 单次拉取条数上限 */
  limit?: number;

  /** 偏移量，从 0 开始，用于分页翻页 */
  offset?: number;
}

/**
 * 更新评论 Mutation 的变量
 * @description 复用 {@link CreateCommentDto}，因为更新只涉及正文一个字段
 */
export interface UpdateCommentMutationVars {
  /** 目标评论 ID */
  commentId: string;

  /** 更新后的正文 */
  dto: CreateCommentDto;
}
