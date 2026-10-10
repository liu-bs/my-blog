export interface Post {
  id: string;

  title: string;

  summary: string;

  content: string;

  contentRaw?: string;

  category: string;

  tags: string[];

  createdAt: string;

  updatedAt: string;

  publishedAt?: string;

  isDraft: boolean;

  pinned?: boolean;

  coverImage?: string;

  authorId?: string;

  authorName?: string;

  views: number;

  likes: number;

  favorites?: number;

  commentsCount: number;
}

export interface PostListParams {
  draft?: "true";

  category?: string;

  tag?: string;

  q?: string;

  page?: number;

  limit?: number;
}

export interface CreatePostDto {
  title: string;

  summary?: string;

  content: string;

  category: string;

  tags?: string | string[];

  isDraft: boolean;

  pinned?: boolean;

  coverImage?: string;
}

export type UpdatePostDto = Partial<CreatePostDto>;

export interface UpdatePostMutationVars {
  id: string;

  dto: UpdatePostDto;
}

export interface PostsListData {
  posts: Post[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}

export interface PostData {
  post: Post;
}

export interface LikeToggleData {
  liked: boolean;

  likes: number;
}

export interface FavoriteToggleData {
  favorited: boolean;

  favorites: number;
}

export interface CategoryListData {
  categories: string[];
}

export interface TagListData {
  tags: PostTagCount[];
}

export interface PostTagCount {
  name: string;

  count: number;
}

export interface NeighborPostsData {
  prev: Post | null;

  next: Post | null;
}

export interface TocItem {
  id: string;

  text: string;

  sub: boolean;
}

export type PostCounterField = "views" | "likes" | "favorites" | "commentsCount";
