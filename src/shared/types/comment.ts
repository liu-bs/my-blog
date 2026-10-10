export interface Comment {
  id: string;

  postId: string;

  userId: string;

  userName: string;

  userAvatar?: string;

  content: string;

  createdAt: string;

  updatedAt: string;
}

export interface CreateCommentDto {
  content: string;
}

export interface CommentsListData {
  comments: Comment[];

  total: number;

  hasMore: boolean;
}

export interface UpdateCommentMutationVars {
  commentId: string;

  dto: CreateCommentDto;
}
