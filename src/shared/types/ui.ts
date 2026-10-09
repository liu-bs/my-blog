/**
 * @file ui.ts
 * @description UI 层类型集合：通用展示组件（Alert、Avatar、Modal、Button、Tag 等）的 Props 定义、
 *              业务组件（文章卡片、评论区、侧边栏）入参，以及跨端共用的校验错误结构
 *              {@link ValidationErrorDetail} 和客户端请求选项 {@link RequestOptions}。
 *              组件实现位于 `src/components/`，页面与 Server Action 客户端均从 `@shared` 引用这些类型。
 */
import type {
  ReactNode,
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  InputHTMLAttributes,
} from "react";
import type { Post } from "./blog";
import type { CommentsListData } from "./comment";
import type { User } from "./user";

/** 仅包含子节点与样式类名的最小容器属性包 */
interface ChildrenProps {
  /** 子节点内容 */
  children: ReactNode;

  /** 附加的 CSS 类名，用于调用方定制样式 */
  className?: string;
}

/** 提示条视觉风格：success-成功、warning-警告、error-错误、info-普通信息 */
export type AlertVariant = "success" | "warning" | "error" | "info";

/** Alert 提示条组件 Props */
export interface AlertProps {
  /** 视觉风格，见 {@link AlertVariant} */
  variant: AlertVariant;

  /** 自定义图标节点，缺省按 variant 使用内置图标 */
  icon?: ReactNode;

  /** 提示内容 */
  children: ReactNode;

  /** 是否可见，缺省视为 true，用于受控显隐场景 */
  visible?: boolean;

  /** 附加 CSS 类名 */
  className?: string;
}

/** ArticleCard 文章卡片组件 Props，展示 {@link Post} 的摘要视图 */
export interface ArticleCardProps {
  /** 要展示的文章数据 */
  post: Post;

  /** 自定义点击跳转链接，缺省跳转到文章详情页 /posts/{id} */
  href?: string;

  /** "阅读全文"按钮文案，缺省取国际化默认文案 */
  readMoreLabel?: string;

  /** 角标节点（如"置顶""草稿"标记），缺省不显示 */
  badge?: ReactNode;

  /** 覆盖 post.tags 展示的标签列表，缺省使用文章自身的标签 */
  tags?: string[];

  /** 卡片底部的操作区节点（点赞/收藏按钮等） */
  actions?: ReactNode;

  /** 附加统计项：每项含 icon-图标与 value-数值，展示在基础统计数据之后 */
  extraStats?: { icon: ReactNode; value: number }[];

  /** 封面图宽度（CSS 尺寸值，如 "16rem"），缺省由 variant 决定 */
  coverWidth?: string;

  /** 封面图是否为高优先级加载（Next.js Image 的 priority 属性），列表首屏卡片置 true */
  priority?: boolean;

  /** 附加 CSS 类名 */
  className?: string;

  /** 布局形态：horizontal-封面在侧的横向卡片 / vertical-封面在上的纵向卡片，缺省 horizontal */
  variant?: "horizontal" | "vertical";
}

/** 头像尺寸档位：xs/sm/md/lg/xl，从小到大 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Avatar 头像组件 Props */
export interface AvatarProps {
  /** 无图片时展示的首字母缩写 */
  initials: string;

  /** 尺寸档位，见 {@link AvatarSize}，缺省 md */
  size?: AvatarSize;

  /** 头像图片 URL，缺省或加载失败时渲染 initials 占位 */
  src?: string;

  /** 图片无障碍替代文本，缺省使用 initials */
  alt?: string;

  /** 附加 CSS 类名 */
  className?: string;
}

/** 页面/区块容器组件 Props，等同 {@link ChildrenProps} */
export type ContainerProps = ChildrenProps;

/** CoverFallback 封面兜底占位组件 Props（无封面图或加载失败时渲染） */
export interface CoverFallbackProps {
  /** 附加 CSS 类名 */
  className?: string;
}

/** EmptyState 空状态占位组件 Props */
export interface EmptyStateProps {
  /** 空状态主图标 */
  icon: ReactNode;

  /** 主标题文案 */
  title: string;

  /** 辅助说明文案，缺省不显示 */
  description?: string;

  /** 操作区节点（如"去写一篇文章"按钮），缺省不显示 */
  action?: ReactNode;

  /** 附加 CSS 类名 */
  className?: string;
}

/** FormField 表单字段包装组件 Props：统一渲染标签、提示与错误信息 */
export interface FormFieldProps {
  /** 字段标签文本 */
  label: string;

  /** 标签旁的辅助提示，缺省不显示 */
  hint?: string;

  /** 校验错误信息，非空时以错误态渲染并展示 */
  error?: string;

  /** 是否必填，true 时标签追加必填标记 */
  required?: boolean;

  /** 附加 CSS 类名 */
  className?: string;

  /** 实际表单控件（Input 等）作为子节点传入 */
  children: ReactNode;
}

/** Modal 模态弹窗组件 Props */
export interface ModalProps {
  /** 是否打开弹窗（受控） */
  open: boolean;

  /** 关闭回调（点击遮罩、关闭按钮或 Esc 时触发） */
  onClose: () => void;

  /** 弹窗标题，缺省不渲染标题栏 */
  title?: string;

  /** 弹窗主体内容 */
  children: ReactNode;

  /** 弹窗最大宽度（CSS 尺寸值），缺省使用组件默认宽度 */
  maxWidth?: string;
}

/** PageHeader 页面头部组件 Props */
export interface PageHeaderProps {
  /** 页面主标题 */
  title: ReactNode;

  /** 副标题说明文案，缺省不显示 */
  subtitle?: ReactNode;

  /** 标题右侧操作区节点（按钮等），缺省不显示 */
  actions?: ReactNode;

  /** 附加 CSS 类名 */
  className?: string;
}

/** PasswordStrength 密码强度指示器组件 Props */
export interface PasswordStrengthProps {
  /** 待评估强度的明文密码 */
  password: string;
}

/** Spinner 加载指示器组件 Props */
export interface SpinnerProps {
  /** 尺寸档位：sm-小 / md-中 / lg-大，缺省 md */
  size?: "sm" | "md" | "lg";

  /** 附加 CSS 类名 */
  className?: string;
}

/** 统计网格中的单个统计项（内部使用，经 {@link StatsGridProps} 传入） */
interface StatItem {
  /** 统计项名称（指标标签） */
  label: ReactNode;

  /** 统计项数值（可为数字或带图标的节点） */
  value: ReactNode;
}

/** StatsGrid 统计网格组件 Props */
export interface StatsGridProps {
  /** 统计项列表，见 {@link StatItem} */
  items: StatItem[];

  /** 附加 CSS 类名 */
  className?: string;
}

/** 标签徽章配色主题：ink-墨色 / ember-暖橙 / crimson-绯红 / slate-石板灰 */
export type TagVariant = "ink" | "ember" | "crimson" | "slate";

/** Tag 标签徽章组件 Props */
export interface TagProps {
  /** 标签文本内容 */
  children: ReactNode;

  /** 配色主题，见 {@link TagVariant}，缺省 ink */
  variant?: TagVariant;

  /** 尺寸：sm-小 / md-中，缺省 md */
  size?: "sm" | "md";

  /** 附加 CSS 类名 */
  className?: string;
}

/** 依赖文章 ID 的组件通用 Props */
export interface PostIdProps {
  /** 目标文章 ID */
  postId: string;
}

/** PostsSearchInput 文章搜索输入框组件 Props */
export interface PostsSearchInputProps {
  /** 输入框初始值（通常回填 URL 中的 q 参数），空串表示无关键词 */
  initialValue: string;
}

/** PostSidebar 文章列表侧边栏组件 Props（分类/标签筛选导航） */
export interface PostSidebarProps {
  /** 全部分类名列表 */
  categories: string[];

  /** 全部标签及文章数：name-标签名，count-该标签下已发布文章数 */
  tags: { name: string; count: number }[];

  /** 当前选中的分类名 */
  currentCategory: string;

  /** 当前选中的标签名，未选标签时为 null */
  currentTag: string | null;

  /** 侧边栏下方附加内容（如筛选结果列表） */
  children: ReactNode;

  /** 当前筛选是否零结果，true 时展示空态提示 */
  zeroResults?: boolean;
}

/** PostActions 文章互动操作区（点赞/收藏按钮）组件 Props */
export interface PostActionsProps {
  /** 当前登录用户（{@link User}），未登录时为 null（按钮将引导登录） */
  user: User | null;
}

/** CommentsSection 评论区组件 Props */
export interface CommentsSectionProps {
  /** 所评文章 ID */
  postId: string;

  /** 当前登录用户，未登录时为 null */
  user: User | null;

  /** 文章作者 ID，用于给作者所发评论加"作者"标记；缺省不标记 */
  postAuthorId?: string;

  /** 首屏评论数据（SSR 预取，见 {@link CommentsListData}），null/缺省时由组件自行加载 */
  initialData?: CommentsListData | null;
}

/** PostToc 文章目录组件 Props（挂载后扫描文章标题生成锚点列表） */
export interface PostTocProps {
  /** 文章正文容器的 DOM 元素 id，组件在该容器内扫描 h2/h3 生成目录 */
  articleId: string;
}

/** 按钮视觉风格：primary-主按钮 / ghost-幽灵 / outline-描边 / danger-危险操作 */
export type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

/** 按钮尺寸档位：sm-小 / md-中 / lg-大 */
export type ButtonSize = "sm" | "md" | "lg";

/** Button 两种形态共享的基础 Props（内部使用） */
interface ButtonBaseProps {
  /** 视觉风格，见 {@link ButtonVariant}，缺省 primary */
  variant?: ButtonVariant;

  /** 尺寸档位，见 {@link ButtonSize}，缺省 md */
  size?: ButtonSize;

  /** 加载态：true 时展示 spinner 并禁用点击 */
  loading?: boolean;
}

/** 按钮形态的 Button Props：渲染为 <button>，href 必须为 undefined */
export type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** 链接形态的 Button Props：渲染为 <a>，必须携带 href */
export type ButtonAsLink = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Button 组件 Props：按是否传 href 判别渲染为按钮或链接，见 {@link ButtonAsButton} / {@link ButtonAsLink} */
export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Input 输入框组件 Props，继承原生 input 全部属性 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 输入框左侧图标节点（如搜索放大镜），缺省不渲染 */
  leftIcon?: ReactNode;

  /** 输入框右侧自定义元素（如清除按钮），缺省不渲染 */
  rightElement?: ReactNode;

  /** 错误态：true 时以红色描边渲染 */
  error?: boolean;

  /** 成功态：true 时以绿色描边渲染 */
  success?: boolean;
}

/**
 * 字段级校验错误详情
 * @description Server Action 失败分支（{@link ActionResult}）与 ApiRequestError 均可能携带该列表，
 *              前端按 path 定位到对应表单控件展示 message。
 */
export interface ValidationErrorDetail {
  /** 出错字段的点分路径，如 "title"、"tags[0]"、"social.github" */
  path: string;

  /** 面向用户的可读错误文案 */
  message: string;

  /** 机器可读错误码（如 zod  issue code），缺省表示无细分码 */
  code?: string;

  /** 触发的校验规则名，见 {@link ValidationRule}，缺省表示通用校验失败 */
  rule?: ValidationRule;

  /** 规则参数：min/max 为该约束的边界值（如长度上下限，单位字符数），仅部分规则携带 */
  params?: { min?: number; max?: number };
}

/** 自定义校验规则名：imageUrl-图片地址合法性 / nonBlank-去空白后非空 / passwordMismatch-两次密码不一致 */
export type ValidationRule = "imageUrl" | "nonBlank" | "passwordMismatch";

/**
 * 客户端统一请求封装（`@/lib/apiRequest`）的选项，继承原生 RequestInit（剔除 body/cache 后扩展）
 */
export interface RequestOptions extends Omit<RequestInit, "body" | "cache"> {
  /** 请求体对象，封装层自动 JSON 序列化为字符串；缺省表示无请求体 */
  body?: unknown;

  /** 查询参数：值会被序列化拼接到 URL，null/undefined 的键将被跳过 */
  query?: Record<string, string | number | boolean | null | undefined>;

  /** 是否跳过 401 自动处理：true 时不在未授权时触发 token 刷新重试与登录跳转，静默接口置 true */
  skipAuthRedirect?: boolean;

  /** 原生 Fetch Cache 策略（如 "no-store"、"reload"），覆盖封装层默认值 */
  cache?: RequestCache;
}
