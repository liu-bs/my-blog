/**
 * @file comment.ts
 * @description 评论领域类型：评论实体、创建入参 DTO、评论列表分页数据及查询/更新辅助类型
 */
import type { AuthPayload } from "./user";

/**
 * 评论实体
 */
export interface Comment {
  /** 评论唯一 ID */
  id: string;

  /** 所属文章 ID */
  postId: string;

  /** 评论者用户 ID */
  userId: string;

  /** 评论者展示昵称（冗余字段，避免联表查询） */
  userName: string;

  /** 评论者头像 URL，可能未设置 */
  userAvatar?: string;

  /** 评论正文 */
  content: string;

  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;

  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string;
}

/**
 * 创建评论入参 DTO
 */
export interface CreateCommentDto {
  /** 评论正文 */
  content: string;
}

/**
 * 评论列表分页数据
 */
export interface CommentsListData {
  /** 当前页评论列表 */
  comments: Comment[];

  /** 评论总数 */
  total: number;

  /** 是否还有下一页 */
  hasMore: boolean;
}

/**
 * 查询评论列表的选项
 */
export interface ListCommentsOptions {
  /** 目标文章 ID */
  postId: string;

  /** 当前登录用户，用于服务端标记可删除/可编辑的评论，未登录可省略 */
  user?: AuthPayload;

  /** 每页条数 */
  limit?: number;

  /** 偏移量，从 0 开始 */
  offset?: number;
}

/**
 * 更新评论的 Mutation 变量
 */
export interface UpdateCommentMutationVars {
  /** 待更新的评论 ID */
  commentId: string;

  /** 更新内容（目前仅正文） */
  dto: CreateCommentDto;
}
