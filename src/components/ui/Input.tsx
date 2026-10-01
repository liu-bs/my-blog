/**
 * @file Input.tsx
 * @description 通用输入框组件：支持左侧图标、右侧元素（如密码切换按钮）、error/success 状态样式；error 时设置 aria-invalid 供读屏软件识别
 */
import type { InputProps } from "@shared";

/**
 * Input 输入框
 * @description 无左右缀饰时直接渲染原生 input；有 leftIcon/rightElement 时包一层相对定位容器
 * @param props {@link InputProps} 受控值、事件与左右缀饰元素，ref 指向 input 元素
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
  /** 是否存在左右缀饰元素，决定是否渲染包裹容器 */
  const hasAffix = Boolean(leftIcon || rightElement);

  const inputClass = [
    "input-field input-focus",
    leftIcon ? "pl-10" : "",
    rightElement ? "pr-10" : "",
    error ? "input-error" : success ? "input-success" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // error 优先于 success；error 时同步 aria-invalid
  const inputProps = { "aria-invalid": error || undefined, ...props };

  if (!hasAffix) {
    return <input ref={ref} className={inputClass} {...inputProps} />;
  }

  return (
    <div className="input-icon-wrap">
      {leftIcon && <span className="input-icon">{leftIcon}</span>}
      <input ref={ref} className={inputClass} {...inputProps} />

      {rightElement && (
        <span className="absolute top-1/2 right-3 -translate-y-1/2">{rightElement}</span>
      )}
    </div>
  );
}
