/**
 * @file ui.ts
 * @description UI 组件层共享类型：通用组件 Props（Alert/Avatar/Button/Input/Modal 等）、
 *              文章页组件 Props、表单校验错误结构及前端请求选项
 */
import type {
  ReactNode,
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  InputHTMLAttributes,
} from "react";
import type { Post } from "./blog";
import type { User } from "./user";

/**
 * 带子内容与自定义类名的基础 Props
 */
interface ChildrenProps {
  /** 子元素 */
  children: ReactNode;

  /** 自定义类名 */
  className?: string;
}

/**
 * Alert 提示条主题变体
 * success-成功 warning-警告 error-错误 info-信息
 */
export type AlertVariant = "success" | "warning" | "error" | "info";

/**
 * Alert 提示条组件 Props
 */
export interface AlertProps {
  /** 提示条主题 {@link AlertVariant} */
  variant: AlertVariant;

  /** 自定义图标元素 */
  icon?: ReactNode;

  /** 提示内容 */
  children: ReactNode;

  /** 是否可见，false 时折叠隐藏 */
  visible?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 文章卡片组件 Props
 */
export interface ArticleCardProps {
  /** 文章数据 */
  post: Post;

  /** 自定义跳转链接，缺省按文章 ID 生成 */
  href?: string;

  /** 自定义“阅读全文”文案（i18n 场景传入） */
  readMoreLabel?: string;

  /** 卡片角标（如置顶/草稿标记） */
  badge?: ReactNode;

  /** 覆盖展示的标签列表，缺省用文章自身标签 */
  tags?: string[];

  /** 自定义操作区（如编辑/删除按钮） */
  actions?: ReactNode;

  /** 附加统计项（图标 + 数值），如浏览量/点赞数 */
  extraStats?: { icon: ReactNode; value: number }[];

  /** 封面图容器宽度（CSS 值） */
  coverWidth?: string;

  /** 是否首屏优先加载封面图（Next.js Image priority） */
  priority?: boolean;

  /** 自定义类名 */
  className?: string;

  /** 布局方向：horizontal-横排 vertical-纵排 */
  variant?: "horizontal" | "vertical";
}

/**
 * 头像尺寸
 * xs-超小 sm-小 md-中 lg-大 xl-特大
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Avatar 头像组件 Props
 */
export interface AvatarProps {
  /** 无图时展示的姓名首字母 */
  initials: string;

  /** 头像尺寸 {@link AvatarSize} */
  size?: AvatarSize;

  /** 头像图片地址 */
  src?: string;

  /** 图片替代文本 */
  alt?: string;

  /** 自定义类名 */
  className?: string;
}

/** Container 布局容器组件 Props */
export type ContainerProps = ChildrenProps;

/**
 * 封面图兜底组件 Props
 */
export interface CoverFallbackProps {
  /** 自定义类名 */
  className?: string;
}

/**
 * 空状态占位组件 Props
 */
export interface EmptyStateProps {
  /** 空状态图标 */
  icon: ReactNode;

  /** 标题文案 */
  title: string;

  /** 描述文案 */
  description?: string;

  /** 操作区（如“去写作”按钮） */
  action?: ReactNode;

  /** 自定义类名 */
  className?: string;
}

/**
 * 表单字段容器组件 Props：统一 label/提示/错误信息的布局
 */
export interface FormFieldProps {
  /** 字段标签文本 */
  label: string;

  /** 辅助提示文案（如长度限制） */
  hint?: string;

  /** 校验错误文案，存在时以错误态展示 */
  error?: string;

  /** 是否必填（展示必填标记） */
  required?: boolean;

  /** 自定义类名 */
  className?: string;

  /** 字段控件（input/textarea 等） */
  children: ReactNode;
}

/**
 * Modal 弹窗组件 Props
 */
export interface ModalProps {
  /** 是否打开 */
  open: boolean;

  /** 关闭回调（点击遮罩/关闭按钮时触发） */
  onClose: () => void;

  /** 弹窗标题 */
  title?: string;

  /** 弹窗内容 */
  children: ReactNode;

  /** 内容区最大宽度（CSS 值） */
  maxWidth?: string;
}

/**
 * 页面头部组件 Props
 */
export interface PageHeaderProps {
  /** 页面标题 */
  title: ReactNode;

  /** 副标题 */
  subtitle?: ReactNode;

  /** 右侧操作区（如“新建”按钮） */
  actions?: ReactNode;

  /** 自定义类名 */
  className?: string;
}

/**
 * 密码强度指示组件 Props
 */
export interface PasswordStrengthProps {
  /** 待评估的密码明文 */
  password: string;
}

/**
 * Spinner 加载指示器组件 Props
 */
export interface SpinnerProps {
  /** 尺寸：sm-小 md-中 lg-大 */
  size?: "sm" | "md" | "lg";

  /** 自定义类名 */
  className?: string;
}

/**
 * 统计项（标签 + 值）
 */
interface StatItem {
  /** 统计项名称 */
  label: ReactNode;

  /** 统计数值 */
  value: ReactNode;
}

/**
 * 统计网格组件 Props
 */
export interface StatsGridProps {
  /** 统计项列表 */
  items: StatItem[];

  /** 自定义类名 */
  className?: string;
}

/**
 * Tag 标签主题变体
 * ink-墨色 ember-橙红 crimson-绯红 slate-灰蓝
 */
export type TagVariant = "ink" | "ember" | "crimson" | "slate";

/**
 * Tag 标签组件 Props
 */
export interface TagProps {
  /** 标签文本 */
  children: ReactNode;

  /** 主题色 {@link TagVariant} */
  variant?: TagVariant;

  /** 尺寸：sm-小 md-中 */
  size?: "sm" | "md";

  /** 自定义类名 */
  className?: string;
}

/**
 * 需要文章 ID 的组件通用 Props
 */
export interface PostIdProps {
  /** 文章 ID */
  postId: string;
}

/**
 * 文章搜索框组件 Props
 */
export interface PostsSearchInputProps {
  /** 初始搜索关键词（从 URL 同步） */
  initialValue: string;
}

/**
 * 文章列表页侧边栏组件 Props
 */
export interface PostSidebarProps {
  /** 全部分类名列表 */
  categories: string[];

  /** 标签列表（名称 + 文章计数） */
  tags: { name: string; count: number }[];

  /** 当前选中的分类（"全部" 表示不限） */
  currentCategory: string;

  /** 当前选中的标签，null 表示不限 */
  currentTag: string | null;

  /** 列表主体内容 */
  children: ReactNode;

  /** 筛选结果是否为空（展示空态） */
  zeroResults?: boolean;
}

/**
 * 文章页操作区组件 Props（点赞/收藏/编辑/删除等）
 */
export interface PostActionsProps {
  /** 当前登录用户，null 表示未登录 */
  user: User | null;
}

/**
 * 评论区组件 Props
 */
export interface CommentsSectionProps {
  /** 所属文章 ID */
  postId: string;

  /** 当前登录用户，null 表示未登录（仅可浏览） */
  user: User | null;

  /** 文章作者 ID，用于判定评论的作者权限 */
  postAuthorId?: string;
}

/**
 * 文章目录（TOC）组件 Props
 */
export interface PostTocProps {
  /** 文章 ID，用于拉取目录数据 */
  articleId: string;
}

/**
 * Button 按钮主题变体
 * primary-主要 ghost-幽灵 outline-描边 danger-危险
 */
export type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

/**
 * Button 按钮尺寸
 */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Button 两种形态共有的基础 Props
 */
interface ButtonBaseProps {
  /** 主题色 {@link ButtonVariant} */
  variant?: ButtonVariant;

  /** 尺寸 {@link ButtonSize} */
  size?: ButtonSize;

  /** 是否加载中（禁用并显示 spinner） */
  loading?: boolean;
}

/** 渲染为原生 button 的形态：href 必须为 undefined */
export type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** 渲染为原生 a 链接的形态：href 必填 */
export type ButtonAsLink = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Button 组件 Props：按是否传 href 区分为按钮或链接形态的可区分联合 */
export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Input 输入框组件 Props：扩展原生 input 属性，增加图标与状态标记
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 左侧图标元素 */
  leftIcon?: ReactNode;

  /** 右侧附加元素（如显示密码按钮） */
  rightElement?: ReactNode;

  /** 是否错误态（红色描边） */
  error?: boolean;

  /** 是否成功态 */
  success?: boolean;
}

/**
 * 表单校验错误详情：由 formatZodIssues 从 zod issue 转换而来
 */
export interface ValidationErrorDetail {
  /** 字段路径，嵌套字段以 . 连接 */
  path: string;

  /** 错误提示文案 */
  message: string;

  /** zod 错误码（如 too_small、invalid_format） */
  code?: string;

  /** 业务自定义规则标识 {@link ValidationRule} */
  rule?: ValidationRule;

  /** 长度边界参数，用于渲染“至少/至多 N 个字符”类提示 */
  params?: { min?: number; max?: number };
}

/**
 * 业务自定义校验规则标识
 * imageUrl-图片地址不安全 nonBlank-纯空白字符 passwordMismatch-新旧密码相同
 */
export type ValidationRule = "imageUrl" | "nonBlank" | "passwordMismatch";

/**
 * 前端 fetch 封装的请求选项：扩展 RequestInit，支持任意可序列化 body、查询串与鉴权跳过标记
 */
export interface RequestOptions extends Omit<RequestInit, "body" | "cache"> {
  /** 请求体，由封装层负责序列化（默认 JSON） */
  body?: unknown;

  /** URL 查询参数，undefined/null 的键会被丢弃 */
  query?: Record<string, string | number | boolean | null | undefined>;

  /** 为 true 时 401 不触发自动跳转登录页（登录接口本身需要） */
  skipAuthRedirect?: boolean;

  /** Next.js 数据缓存策略 */
  cache?: RequestCache;
}
