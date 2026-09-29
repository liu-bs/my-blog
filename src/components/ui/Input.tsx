/**
 * @file Input.tsx
 * @description 通用文本输入框，支持左右附加内容（图标 / 按钮），并透传全部原生 input 属性
 */
import type { InputProps } from "@shared";

/**
 * Input 输入框
 * @param props {@link InputProps}，除 leftIcon / rightElement / error / success 外的属性会原样透传给原生 input
 * @returns 无附加内容时直接返回原生 input，否则用相对定位容器包裹 input 与附加元素
 * @warning error 为真时会写入 aria-invalid，rightElement 自行承担可访问性标签（如 PasswordToggle）
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
  /** 是否存在左右附加内容，决定是否需要额外的定位容器 */
  const hasAffix = Boolean(leftIcon || rightElement);

  // 左右留白按附加内容存在与否补齐，防止文字被图标遮挡
  const inputClass = [
    "input-field input-focus",
    leftIcon ? "pl-10" : "",
    rightElement ? "pr-10" : "",
    error ? "input-error" : success ? "input-success" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  /** 错误态下标记 aria-invalid，供读屏与表单校验识别；正常态不输出该属性 */
  const inputProps = { "aria-invalid": error || undefined, ...props };

  if (!hasAffix) {
    return <input ref={ref} className={inputClass} {...inputProps} />;
  }

  return (
    <div className="input-icon-wrap">
      {/* 左图标常作为纯装饰，样式类已处理定位 */}
      {leftIcon && <span className="input-icon">{leftIcon}</span>}
      <input ref={ref} className={inputClass} {...inputProps} />

      {/* 右侧交互元素（如密码可见性切换按钮）绝对定位在输入框内 */}
      {rightElement && (
        <span className="absolute top-1/2 right-3 -translate-y-1/2">{rightElement}</span>
      )}
    </div>
  );
}
