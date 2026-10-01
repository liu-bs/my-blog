/**
 * @file Button.tsx
 * @description 通用按钮组件，收敛全站按钮的形态、尺寸与 loading 表现；传入 href 时降级渲染为 i18n 感知的链接
 */
import { Link } from "@/i18n/navigation";
import type { ButtonProps, ButtonVariant, ButtonSize, ButtonAsButton, ButtonAsLink } from "@shared";
import { Spinner } from "./Spinner";

/** variant 到样式类的映射，具体样式定义见 app/styles */
const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  danger: "btn-danger",
};

/** size 到尺寸样式类的映射 */
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 rounded-md text-(length:--type-xs) leading-normal",
  md: "h-9 px-4 rounded-md text-(length:--type-xs) leading-normal",
  lg: "h-10 px-6 rounded-md text-(length:--type-sm) leading-normal",
};

/** 各尺寸共用的基础样式，集中处理禁用与 aria-disabled 态 */
const baseClass =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-smooth disabled:cursor-not-allowed disabled:opacity-50 &[aria-disabled='true']:opacity-50 &[aria-disabled='true']:pointer-events-none";

/**
 * Button 通用按钮
 * @param props {@link ButtonProps}，额外透传的 ref 会按最终渲染的元素类型断言
 * @returns 传入 href 时返回链接元素，否则返回原生 button
 * @example
 * <Button variant="primary" loading={pending}>保存</Button>
 * @warning loading 期间链接分支只拦截 onClick 而不用 disabled，以保留键盘可达性与焦点语义
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
      {/* loading 时在左侧追加 spinner，文字位置随之偏移但不改变按钮高度 */}
      {loading && <Spinner size="sm" aria-hidden="true" />}
      {children}
    </button>
  );
}
