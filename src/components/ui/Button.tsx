/**
 * @file Button.tsx
 * @description 基础按钮组件，双形态渲染：传 href 时渲染为 next/link 链接按钮，否则渲染为原生 button；
 * 支持 primary/ghost/outline/danger 四种变体、sm/md/lg 三种尺寸及 loading 置灰禁用态
 */
import Link from "next/link";
import type { ButtonProps, ButtonVariant, ButtonSize, ButtonAsButton, ButtonAsLink } from "@shared";
import { Spinner } from "./Spinner";

/** 按钮变体到样式类名的映射 */
const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  danger: "btn-danger",
};

/** 尺寸档位到高度、内边距、圆角与字号类名的映射 */
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 rounded-md text-(length:--type-xs) leading-normal",
  md: "h-9 px-4 rounded-md text-(length:--type-xs) leading-normal",
  lg: "h-10 px-6 rounded-md text-(length:--type-sm) leading-normal",
};

/** 按钮基础布局、过渡动效与 disabled/aria-disabled 态样式 */
const baseClass =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-smooth disabled:cursor-not-allowed disabled:opacity-50 &[aria-disabled='true']:opacity-50 &[aria-disabled='true']:pointer-events-none";

/**
 * 基础按钮组件
 * @param props.variant 按钮变体，默认 primary {@link ButtonVariant}
 * @param props.size 尺寸档位，默认 md {@link ButtonSize}
 * @param props.loading 加载态：置灰、aria-busy、前置 Spinner，链接态还会阻止默认跳转
 * @param props.className 追加到根元素的自定义类名
 * @param props.children 按钮文本或内容
 * @param props.ref React 19 ref 转发，绑定到 button 或 link 元素
 * @param props 其余原生属性透传；href 存在时按 {@link ButtonAsLink} 渲染为链接，否则按 {@link ButtonAsButton} 渲染为按钮
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

  /* 链接分支：存在 href 时用 next/link 渲染，loading 时拦截点击 */
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
        {/* 加载态前置 Spinner，对读屏隐藏 */}
        {loading && <Spinner size="sm" aria-hidden="true" />}
        {children}
      </Link>
    );
  }

  /* 原生 button 分支：loading 与 disabled 合并为禁用条件 */
  const { ...buttonProps } = props as ButtonAsButton;
  return (
    <button
      className={cls}
      disabled={loading || (props as ButtonAsButton).disabled}
      aria-busy={loading}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...buttonProps}
    >
      {/* 加载态前置 Spinner，对读屏隐藏 */}
      {loading && <Spinner size="sm" aria-hidden="true" />}
      {children}
    </button>
  );
}
