/**
 * @file Alert.tsx
 * @description 通用内联提示条，按 variant 切换语义色并给出对应的 ARIA role，用于表单反馈与页面级提示
 */
import type { AlertProps, AlertVariant } from "@shared";

/** variant 到提示条样式类的映射，具体配色由 app/styles 中的 alert-* 类定义 */
const variantClass: Record<AlertVariant, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};

/**
 * Alert 内联提示条
 * @param props {@link AlertProps}
 * @returns 提示条容器；visible 为 false 时仅切换 display，节点保持挂载以便动画与状态保留
 * @warning error / warning 使用 role="alert"（立即打断式播报），其余使用 role="status"（礼貌播报），不可随意互换
 */
export function Alert({ variant, icon, children, visible = true, className = "" }: AlertProps) {
  return (
    // visible 通过 flex/hidden 切换而非卸载，避免提示内容在出现/消失时丢焦
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={`row-sm rounded-lg px-3.5 py-2.5 text-(length:--type-xs) leading-normal shadow-[inset_0_0_0_1px_var(--alert-ring)] ${variantClass[variant]} ${visible ? "flex" : "hidden"} ${className}`}
    >
      {/* 图标仅作装饰，语义已由外层 role 表达，故对辅助技术隐藏 */}
      {icon && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {/* 提示正文 */}
      <span>{children}</span>
    </div>
  );
}
