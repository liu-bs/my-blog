/**
 * @file CommentCardView.tsx
 * @description 评论卡片视图组件（纯展示）：渲染评论者头像、昵称、相对时间与评论内容；
 * 内容可通过 children 插槽自定义（如编辑态表单），默认直接展示 comment.content 文本。
 * 被 CommentsSection 与 LazyIslands 的评论预览共用。
 */
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime, getInitials, splitName } from "@shared/format";
import type { Comment } from "@shared";

/**
 * CommentCardView 组件入参
 */
interface CommentCardViewProps {
  /** 评论数据 */
  comment: Comment;

  /** 内容区插槽，缺省时渲染评论正文文本 */
  children?: ReactNode;
}

/**
 * 评论卡片视图
 * @param comment 评论数据
 * @param children 自定义内容区（如编辑表单）
 */
export function CommentCardView({ comment, children }: CommentCardViewProps) {
  // 拆分昵称用于生成头像首字母
  const { firstName, lastName } = splitName(comment.userName);

  return (
    <div className="row-md card card-hover p-4">
      {/* 评论者头像：有头像地址用图片，否则用姓名首字母兜底 */}
      <Avatar
        initials={getInitials(firstName, lastName)}
        src={comment.userAvatar || undefined}
        size="md"
      />

      <div className="min-w-0 flex-1">
        {/* 昵称 + 相对发布时间（suppressHydrationWarning 规避服务端/客户端时间差） */}
        <div className="mb-1.5 row-md">
          <span className="text-(length:--type-sm) leading-normal font-semibold text-heading">
            {comment.userName}
          </span>

          <span className="meta-text" suppressHydrationWarning>
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>

        {/* 内容区：优先渲染插槽（编辑态等），否则展示评论正文 */}
        {children ?? (
          <p className="text-(length:--type-sm) leading-normal break-words text-body">
            {comment.content}
          </p>
        )}
      </div>
    </div>
  );
}
