/**
 * @file ui.ts
 * @description UI 层的共享契约：把各展示组件（Alert / Avatar / Button / Tag / Modal 等）的 Props
 *              与若干 UI 语义联合类型集中在这里，供组件与页面共同引用，避免组件间互相 import 造成环依赖。
 * @warning 这里的联合成员取值同时被组件样式映射与业务代码引用，增删成员需同步检查两端
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
 * 仅含子节点与类名的通用容器 Props
 */
interface ChildrenProps {
  /** 容器内容 */
  children: ReactNode;

  /** 追加的 className，由调用方控制外层样式 */
  className?: string;
}

/**
 * Alert 提示语义
 * - success：操作成功
 * - warning：需要留意但未失败
 * - error：操作失败或校验不通过
 * - info：中性说明
 */
export type AlertVariant = "success" | "warning" | "error" | "info";

/**
 * Alert 提示条 Props
 */
export interface AlertProps {
  /** 提示语义，决定配色与默认图标 */
  variant: AlertVariant;

  /** 自定义图标，传入后覆盖按 variant 推导的默认图标 */
  icon?: ReactNode;

  /** 提示文案内容 */
  children: ReactNode;

  /** 是否显示；传 false 时直接不渲染，便于上层用状态控制显隐 */
  visible?: boolean;

  /** 追加的 className */
  className?: string;
}

/**
 * 文章卡片 Props
 */
export interface ArticleCardProps {
  /** 文章数据，卡片的标题、摘要、统计等均取自它 */
  post: Post;

  /** 详情页链接，默认指向文章的规范路径 */
  href?: string;

  /** 「阅读更多」文案，默认取 i18n 文案 */
  readMoreLabel?: string;

  /** 卡片右上角角标插槽，常用于「草稿 / 置顶」标记 */
  badge?: ReactNode;

  /** 覆盖文章自带的标签列表，用于自定义展示 */
  tags?: string[];

  /** 卡片底部操作区插槽，常用于点赞 / 收藏按钮 */
  actions?: ReactNode;

  /** 追加展示的统计项（图标 + 数值），在默认统计之后渲染 */
  extraStats?: { icon: ReactNode; value: number }[];

  /** 封面容器的宽度类；仅横向布局生效，纵向布局固定为 16:10 满宽 */
  coverWidth?: string;

  /** 是否对该封面图启用 next/image 的 priority（首屏 LCP 图片设为 true 以避免懒加载） */
  priority?: boolean;

  /** 追加的 className */
  className?: string;

  /** 卡片布局方向：horizontal 左图右文（默认），vertical 上图下文 */
  variant?: "horizontal" | "vertical";
}

/**
 * 头像尺寸档位，由 xs 到 xl 递增
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * 头像 Props
 */
export interface AvatarProps {
  /** 无图或加载失败时展示的首字母缩写 */
  initials: string;

  /** 尺寸档位，默认 md */
  size?: AvatarSize;

  /** 头像图片地址，为空时降级展示 initials */
  src?: string;

  /** 图片 alt 文本，服务于无障碍 */
  alt?: string;

  /** 追加的 className */
  className?: string;
}

/**
 * 通用容器 Props
 * @description 与 {@link ChildrenProps} 同构，导出别名以便组件签名自解释
 */
export type ContainerProps = ChildrenProps;

/**
 * 封面加载失败时的占位 Props
 */
export interface CoverFallbackProps {
  /** 追加的 className */
  className?: string;
}

/**
 * 空状态 Props
 */
export interface EmptyStateProps {
  /** 空状态图标 */
  icon: ReactNode;

  /** 主标题，说明「什么为空」 */
  title: string;

  /** 补充说明文案 */
  description?: string;

  /** 引导操作区插槽，如「去写文章」按钮 */
  action?: ReactNode;

  /** 追加的 className */
  className?: string;
}

/**
 * 表单字段容器 Props
 * @description 统一处理 label / 提示 / 错误三行结构，本身不承载输入控件
 */
export interface FormFieldProps {
  /** 字段标签 */
  label: string;

  /** 辅助提示，与 error 互斥展示（有错误时优先展示错误） */
  hint?: string;

  /** 错误文案，为空表示校验通过 */
  error?: string;

  /** 是否必填，用于在标签后追加必填标记 */
  required?: boolean;

  /** 追加的 className */
  className?: string;

  /** 具体的输入控件 */
  children: ReactNode;
}

/**
 * 模态框 Props
 */
export interface ModalProps {
  /** 是否打开；由父组件受控，组件内部不自持状态 */
  open: boolean;

  /** 关闭回调，蒙层点击与关闭按钮都会触发，由父组件负责置 open 为 false */
  onClose: () => void;

  /** 标题，省略时只渲染内容区 */
  title?: string;

  /** 模态框内容 */
  children: ReactNode;

  /** 最大宽度样式值，用于覆盖默认宽度 */
  maxWidth?: string;
}

/**
 * 页头 Props
 */
export interface PageHeaderProps {
  /** 主标题，可为富文本节点 */
  title: ReactNode;

  /** 副标题 / 描述 */
  subtitle?: ReactNode;

  /** 右侧操作区插槽 */
  actions?: ReactNode;

  /** 追加的 className */
  className?: string;
}

/**
 * 密码强度指示器 Props
 */
export interface PasswordStrengthProps {
  /** 待评估的密码明文，组件据此实时计算强度 */
  password: string;
}

/**
 * 加载指示器 Props
 */
export interface SpinnerProps {
  /** 尺寸档位，默认 md */
  size?: "sm" | "md" | "lg";

  /** 追加的 className */
  className?: string;
}

/**
 * 统计项
 */
interface StatItem {
  /** 统计项名称，如「文章」 */
  label: ReactNode;

  /** 统计项数值，可为富文本节点以便附加单位 */
  value: ReactNode;
}

/**
 * 统计网格 Props
 */
export interface StatsGridProps {
  /** 统计项列表 */
  items: StatItem[];

  /** 追加的 className */
  className?: string;
}

/**
 * 标签配色语义
 * - ink：中性主色调
 * - ember：暖色强调
 * - crimson：警示 / 高亮
 * - slate：低对比度灰
 */
export type TagVariant = "ink" | "ember" | "crimson" | "slate";

/**
 * 标签 Props
 */
export interface TagProps {
  /** 标签文本 */
  children: ReactNode;

  /** 配色语义，默认 ink */
  variant?: TagVariant;

  /** 尺寸档位，默认 md */
  size?: "sm" | "md";

  /** 追加的 className */
  className?: string;
}

/**
 * 文章 ID 展示组件 Props
 * @description 用于需要按文章 ID 拉取自身数据的展示型组件
 */
export interface PostIdProps {
  /** 文章 ID */
  postId: string;
}

/**
 * 文章搜索框 Props
 */
export interface PostsSearchInputProps {
  /** 搜索框初始值，通常回填自 URL query */
  initialValue: string;
}

/**
 * 文章列表侧边栏 Props
 */
export interface PostSidebarProps {
  /** 分类列表，用于渲染分类筛选项 */
  categories: string[];

  /** 标签及文章数，用于渲染标签云并按热度排序 */
  tags: { name: string; count: number }[];

  /** 当前选中的分类名 */
  currentCategory: string;

  /** 当前选中的标签名，null 表示未按标签筛选 */
  currentTag: string | null;

  /** 侧边栏内容 */
  children: ReactNode;

  /** 当前筛选结果是否为空，为 true 时给出不同的引导文案 */
  zeroResults?: boolean;
}

/**
 * 文章互动操作区 Props
 * @description 点赞 / 收藏按钮，未登录时按钮引导登录
 */
export interface PostActionsProps {
  /** 当前登录用户，null 表示未登录 */
  user: User | null;
}

/**
 * 评论区 Props
 */
export interface CommentsSectionProps {
  /** 目标文章 ID */
  postId: string;

  /** 当前登录用户，null 时隐藏发表框并引导登录 */
  user: User | null;

  /** 文章作者 ID，用于判断当前用户是否为作者（作者可删任意评论） */
  postAuthorId?: string;
}

/**
 * 文章目录组件 Props
 */
export interface PostTocProps {
  /** 正文容器的元素 ID，组件据它扫描标题生成目录并做锚点跳转 */
  articleId: string;
}

/**
 * 按钮视觉语义
 * - primary：主操作
 * - ghost：弱化的无边框操作
 * - outline：次要操作
 * - danger：危险操作（删除等）
 */
export type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

/**
 * 按钮尺寸档位
 */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * 按钮两种形态共用的基础 Props
 */
interface ButtonBaseProps {
  /** 视觉语义，默认 primary */
  variant?: ButtonVariant;

  /** 尺寸档位，默认 md */
  size?: ButtonSize;

  /** 是否处于加载中：加载时禁止点击并展示加载指示 */
  loading?: boolean;
}

/**
 * 渲染为原生 button 的按钮 Props
 * @description `href` 必须为 undefined，用于在判别联合中与 {@link ButtonAsLink} 区分
 */
export type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/**
 * 渲染为链接（通常配合 next/link）的按钮 Props
 * @description `href` 必填，用于在判别联合中与 {@link ButtonAsButton} 区分
 */
export type ButtonAsLink = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * 按钮 Props
 * @description 判别联合：传了 `href` 走链接形态，否则走原生按钮形态
 */
export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * 输入框 Props
 * @description 继承原生 input 属性，其余属性原样透传
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 左侧图标，有值时输入框内容左移避让 */
  leftIcon?: ReactNode;

  /** 右侧自定义元素，如「显示密码」按钮或单位后缀 */
  rightElement?: ReactNode;

  /** 是否处于错误态（红边框） */
  error?: boolean;

  /** 是否处于成功态（绿边框） */
  success?: boolean;
}

/**
 * 字段级校验错误详情
 * @description 服务端 zod 校验失败后随 ActionResult 下发，前端据此把错误回填到对应表单字段
 */
export interface ValidationErrorDetail {
  /** 出错字段路径，多级字段以 "." 连接 */
  path: string;

  /** 服务端默认错误文案（未命中 rule 时展示） */
  message: string;

  /** zod 原始 issue code，如 too_small / too_big / invalid_format */
  code?: string;

  /** 语义化规则标记，命中时前端改用本地化文案覆盖 message */
  rule?: ValidationRule;

  /** 数值边界，配合 min / max 类错误生成「不少于 N 个字符」提示 */
  params?: { min?: number; max?: number };
}

/**
 * 语义化校验规则标记
 * @description 由 schema 的 refine 显式写入 params.rule 带出，用于把服务端错误映射为本地化文案：
 *              imageUrl 图片链接不合法、nonBlank 仅含空白字符、passwordMismatch 新旧密码相同
 */
export type ValidationRule = "imageUrl" | "nonBlank" | "passwordMismatch";

/**
 * 前端请求封装的可选参数
 * @description 在原生 RequestInit 基础上重定义 body / cache，并追加查询参数与鉴权重定向开关
 */
export interface RequestOptions extends Omit<RequestInit, "body" | "cache"> {
  /** 请求体，任意可序列化结构，由封装内部负责 JSON 序列化 */
  body?: unknown;

  /** 查询参数，值为 null / undefined 的项会被自动剔除 */
  query?: Record<string, string | number | boolean | null | undefined>;

  /** 是否跳过 401 自动重定向（如登录接口自身不应触发跳转） */
  skipAuthRedirect?: boolean;

  /** 缓存策略，透传给 fetch */
  cache?: RequestCache;
}
