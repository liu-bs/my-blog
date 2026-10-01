/**
 * @file Button.tsx
 * @description 通用按钮组件，支持 primary/ghost/outline/danger 变体与 sm/md/lg 尺寸；loading 时展示 Spinner 并禁用交互；传入 href 时渲染为国际化 Link，loading 期间阻止跳转
 */
import { Link } from "@/i18n/navigation";
import type { ButtonProps, ButtonVariant, ButtonSize, ButtonAsButton, ButtonAsLink } from "@shared";
import { Spinner } from "./Spinner";

/** 按钮视觉变体 → 样式类名映射 */
const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  danger: "btn-danger",
};

/** 按钮尺寸 → 样式类名映射 */
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 rounded-md text-(length:--type-xs) leading-normal",
  md: "h-9 px-4 rounded-md text-(length:--type-xs) leading-normal",
  lg: "h-10 px-6 rounded-md text-(length:--type-sm) leading-normal",
};

/** 所有变体共用的基础样式：布局、过渡与禁用/aria-disabled 态 */
const baseClass =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-smooth disabled:cursor-not-allowed disabled:opacity-50 &[aria-disabled='true']:opacity-50 &[aria-disabled='true']:pointer-events-none";

/**
 * Button 通用按钮
 * @description 统一入口：loading 时展示 Spinner、置 disabled 并标记 aria-busy；传 href 渲染为 Link（loading 期间 preventDefault 阻止跳转），否则渲染原生 button
 * @param props {@link ButtonProps} 变体/尺寸/loading 等属性，ref 可指向 button 或 a 元素
 */
export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement | HTMLAnchorElement> }) {
  const cls = `${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`;

  // 有 href：渲染为国际化 Link，loading 期间通过 preventDefault 阻止跳转
  if (props.href) {
    const { href, ...anchorProps } = props as ButtonAsLink;
    return (
      <Link
        href={href}
        className={cls}
        ref={ref as React.Ref<HTMLAnchorElement>}
        aria-busy={loading}
        aria-disabled={loading}
        onClick={loading ? (e) => e.preventDefault() : undefined}
        {...anchorProps}
      >
        {loading && <Spinner size="sm" aria-hidden="true" />}
        {children}
      </Link>
    );
  }

  const { ...buttonProps } = props as ButtonAsButton;
  return (
    <button
      className={cls}
      disabled={loading || (props as ButtonAsButton).disabled}
      aria-busy={loading}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...buttonProps}
    >
      {loading && <Spinner size="sm" aria-hidden="true" />}
      {children}
    </button>
  );
}
