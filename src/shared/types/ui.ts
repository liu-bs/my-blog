import type {
  ReactNode,
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  InputHTMLAttributes,
} from "react";
import type { Post, PostTagCount } from "./post";
import type { CommentsListData } from "./comment";
import type { User } from "./user";

export interface ProvidersProps {
  children: ReactNode;
}

export interface ErrorBoundaryProps {
  error: Error & { digest?: string };

  retry: () => void;
}

interface ChildrenProps {
  children: ReactNode;

  className?: string;
}

export type AlertVariant = "success" | "warning" | "error" | "info";

export interface AlertProps {
  variant: AlertVariant;

  icon?: ReactNode;

  children: ReactNode;

  visible?: boolean;

  className?: string;
}

export interface PostCardProps {
  post: Post;

  href?: string;

  readMoreLabel?: string;

  badge?: ReactNode;

  tags?: string[];

  actions?: ReactNode;

  extraStats?: { icon: ReactNode; value: number }[];

  coverWidth?: string;

  priority?: boolean;

  className?: string;

  variant?: "horizontal" | "vertical";
}

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  initials: string;

  size?: AvatarSize;

  src?: string;

  alt?: string;

  className?: string;
}

export type ContainerProps = ChildrenProps;

export interface CoverFallbackProps {
  className?: string;
}

export interface EmptyStateProps {
  icon: ReactNode;

  title: string;

  description?: string;

  action?: ReactNode;

  className?: string;
}

export interface FormFieldProps {
  label: string;

  hint?: string;

  error?: string;

  required?: boolean;

  className?: string;

  children: ReactNode;
}

export interface ModalProps {
  open: boolean;

  onClose: () => void;

  title?: string;

  children: ReactNode;

  maxWidth?: string;
}

export interface PageHeaderProps {
  title: ReactNode;

  subtitle?: ReactNode;

  actions?: ReactNode;

  className?: string;
}

export interface PasswordStrengthProps {
  password: string;
}

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";

  className?: string;
}

interface StatItem {
  label: ReactNode;

  value: ReactNode;
}

export interface StatsGridProps {
  items: StatItem[];

  className?: string;
}

export type TagVariant = "ink" | "ember" | "crimson" | "slate";

export interface TagProps {
  children: ReactNode;

  variant?: TagVariant;

  size?: "sm" | "md";

  className?: string;
}

export interface PostIdProps {
  postId: string;
}

export interface PostSearchInputProps {
  initialValue: string;
}

export interface PostSidebarProps {
  categories: string[];

  tags: PostTagCount[];

  currentCategory: string;

  currentTag: string | null;

  children: ReactNode;

  isEmpty?: boolean;
}

export interface PostActionsProps {
  user: User | null;
}

export interface CommentsSectionProps {
  postId: string;

  user: User | null;

  postAuthorId?: string;

  initialData?: CommentsListData | null;
}

export interface PostTocProps {
  contentId: string;
}

export type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: ButtonVariant;

  size?: ButtonSize;

  isLoading?: boolean;
}

export type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export type ButtonAsLink = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;

  rightElement?: ReactNode;

  error?: boolean;

  success?: boolean;
}
