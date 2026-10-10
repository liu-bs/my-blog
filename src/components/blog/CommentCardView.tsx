import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime, getInitials, splitName } from "@shared/format";
import type { Comment } from "@shared";

interface CommentCardViewProps {

  comment: Comment;

  children?: ReactNode;
}

export function CommentCardView({ comment, children }: CommentCardViewProps) {

  const { firstName, lastName } = splitName(comment.userName);

  return (
    <div className="row-md card card-hover p-4">

      <Avatar
        initials={getInitials(firstName, lastName)}
        src={comment.userAvatar || undefined}
        size="md"
      />

      <div className="min-w-0 flex-1">

        <div className="mb-1.5 row-md">
          <span className="text-(length:--type-sm) leading-normal font-semibold text-heading">
            {comment.userName}
          </span>

          <span className="meta-text" suppressHydrationWarning>
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>

        {children ?? (
          <p className="text-(length:--type-sm) leading-normal break-words text-body">
            {comment.content}
          </p>
        )}
      </div>
    </div>
  );
}
