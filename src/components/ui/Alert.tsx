/**
 * @file Alert.tsx
 * @description 站内通用提示条组件，按 info/success/warning/error 四种语义变体渲染配色与图标；
 * error、warning 使用 role="alert" 立即播报，其余使用 role="status"；常用于表单校验与操作结果反馈
 */
import type { AlertProps, AlertVariant } from "@shared";

/** 语义变体到 Tailwind 样式类名的映射 */
const variantClass: Record<AlertVariant, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};

/**
 * 通用提示条
 * @param props.variant 语义变体，决定颜色类名与无障碍角色 {@link AlertVariant}
 * @param props.icon 可选左侧图标节点
 * @param props.children 提示文案内容
 * @param props.visible 是否可见，默认 true；false 时保留 DOM 但隐藏（hidden）
 * @param props.className 追加到根元素的自定义类名
 */
export function Alert({ variant, icon, children, visible = true, className = "" }: AlertProps) {
  return (
    /* 提示条根容器，error/warning 使用 role=alert，其余使用 role=status */
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={`row-sm rounded-lg px-3.5 py-2.5 text-(length:--type-xs) leading-normal shadow-[inset_0_0_0_1px_var(--alert-ring)] ${variantClass[variant]} ${visible ? "flex" : "hidden"} ${className}`}
    >
      {/* 左侧图标区域，仅装饰用途，对读屏隐藏 */}
      {icon && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}

      {/* 提示文案内容 */}
      <span>{children}</span>
    </div>
  );
}
