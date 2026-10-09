/**
 * @file Input.tsx
 * @description 表单输入框组件，支持左侧图标、右侧自定义元素（如密码切换按钮）、error/success 校验态样式；
 * 无前后缀时渲染裸 input，有前后缀时包裹 .input-icon-wrap 容器定位装饰
 */
import type { InputProps } from "@shared";

/**
 * 输入框组件
 * @param props.leftIcon 输入框左侧装饰图标节点
 * @param props.rightElement 输入框右侧操作元素（如清除按钮、密码显隐按钮）
 * @param props.error 校验失败标记，追加 input-error 类名并设置 aria-invalid
 * @param props.success 校验通过标记，追加 input-success 类名；error 优先于 success
 * @param props.className 追加到 input 元素的自定义类名
 * @param props.ref React 19 ref 转发，绑定到内部 input 元素
 * @param props 其余原生 InputHTMLAttributes 属性透传至 input
 */
export function Input({
  leftIcon,
  rightElement,
  error,
  success,
  className = "",
  ref,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  /* 是否存在前后缀装饰，决定后续渲染裸 input 还是包裹容器 */
  const hasAffix = Boolean(leftIcon || rightElement);

  /* 按前后缀占位、error/success 优先级、外部类名拼接 input 样式串 */
  const inputClass = [
    "input-field input-focus",
    leftIcon ? "pl-10" : "",
    rightElement ? "pr-10" : "",
    error ? "input-error" : success ? "input-success" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  /* error 时透传 aria-invalid，供读屏识别校验失败状态 */
  const inputProps = { "aria-invalid": error || undefined, ...props };

  /* 无前后缀：直接渲染裸 input，避免多余 DOM */
  if (!hasAffix) {
    return <input ref={ref} className={inputClass} {...inputProps} />;
  }

  return (
    /* 带前后缀的输入框容器，装饰元素绝对定位在左右两侧 */
    <div className="input-icon-wrap">
      {/* 左侧装饰图标，绝对定位于左内边距区 */}
      {leftIcon && <span className="input-icon">{leftIcon}</span>}

      <input ref={ref} className={inputClass} {...inputProps} />

      {/* 右侧自定义元素（如密码显隐按钮），垂直居中贴右边缘 */}
      {rightElement && (
        <span className="absolute top-1/2 right-3 -translate-y-1/2">{rightElement}</span>
      )}
    </div>
  );
}
