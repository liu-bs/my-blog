export interface User {
  id: string;

  email: string;

  firstName: string;

  lastName: string;

  username: string;

  avatar: string;

  coverImage: string;

  bio: string;

  location: string;

  website: string;

  joined: string;

  role: string;

  company: string;

  verified: boolean;

  disabled?: boolean;

  tags: string[];

  social: UserSocial;

  stats: UserStats;

  password?: string;

  tokenVersion?: number;

  appearance?: UserAppearance;

  likedPosts?: string[];

  favoritedPosts?: string[];

  createdAt: string;

  updatedAt: string;
}

interface UserSocial {
  twitter: string;

  github: string;

  linkedin: string;
}

interface UserAppearance {
  theme: "light" | "dark" | "system";

  fontSize: "small" | "medium" | "large";
}

export interface UserStats {
  posts: number;

  likes: number;

  views: number;
}

export type UserStatField = keyof UserStats;

export type UserPostAssociation = "likedPosts" | "favoritedPosts";

export interface UserPostState {
  liked: boolean;

  favorited: boolean;
}

export type SafeUser = Omit<
  User,
  "password" | "tokenVersion" | "disabled" | "likedPosts" | "favoritedPosts"
>;
